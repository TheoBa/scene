import cron from "node-cron";
import { events, sourceEvents, type Db } from "@scenes/db";
import { createDb } from "@scenes/db";
import { eq } from "drizzle-orm";
import { ingestTicketmaster, pickImage, type TmImage } from "./sources/ticketmaster.js";
import { ingestOpenAgenda } from "./sources/openagenda.js";
import { ingestDataTourisme } from "./sources/datatourisme.js";
import { ingestFranceBillet } from "./sources/francebillet.js";
import { resolveSourceEvents } from "./resolve.js";
import { computeMetrics, logMetrics, type MetricsSnapshot } from "./metrics.js";
import { DEFAULT_BUDGET } from "./lib/http.js";
import { emptyCounts, finishRun, openRun, type RunCounts } from "./lib/runs.js";

// Best-effort: load the repo-root .env for local dev (TICKETMASTER_API_KEY,
// DATABASE_URL). Production (Coolify) injects env vars directly, so a missing
// file is fine.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  /* no .env on disk — rely on the runtime's injected env */
}

const db = createDb();

// ---------------------------------------------------------------------------
// Steps — idempotent and independently invocable, so scheduling stays pluggable
// (node-cron today; an external orchestrator can call each step tomorrow).
// ---------------------------------------------------------------------------

/** pull — fan out to every source into `source_events`. */
async function stepPull(db: Db): Promise<RunCounts> {
  const counts = emptyCounts();
  const sources: [string, Promise<{ upserted: number; fetched?: number; requests?: number }>][] = [
    ["ticketmaster", ingestTicketmaster(db, DEFAULT_BUDGET)],
    ["openagenda", ingestOpenAgenda(db)],
    ["datatourisme", ingestDataTourisme(db)],
    ["francebillet", ingestFranceBillet(db)],
  ];
  const settled = await Promise.allSettled(sources.map(([, p]) => p));
  settled.forEach((r, i) => {
    const name = sources[i][0];
    if (r.status === "rejected") {
      console.error(`[worker] ${name} failed:`, r.reason);
      return;
    }
    counts.sourceEventsUpserted += r.value.upserted ?? 0;
    counts.fetched += r.value.fetched ?? 0;
    counts.requests += r.value.requests ?? 0;
  });
  return counts;
}

/** metrics — compute the coverage snapshot and log it. */
async function stepMetrics(db: Db): Promise<MetricsSnapshot> {
  const m = await computeMetrics(db);
  logMetrics(m);
  return m;
}

/** all — the orchestrated nightly unit: pull → resolve → metrics, logged as one run. */
async function runAll(db: Db): Promise<void> {
  const runId = await openRun(db, "all");
  const counts = emptyCounts();
  try {
    Object.assign(counts, await stepPull(db));
    const res = await resolveSourceEvents(db);
    counts.eventsUpserted = res.eventsUpserted;
    counts.venuesUpserted = res.venuesUpserted;
    counts.performancesUpserted = res.performancesUpserted;
    counts.artistsUpserted = res.artistsUpserted;
    const metrics = await stepMetrics(db);
    await finishRun(db, runId, { status: "success", counts, metrics });
  } catch (err) {
    console.error("[worker] run failed:", err);
    await finishRun(db, runId, {
      status: "error",
      counts,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * One-off fix (2026-08): `pickImage()` used to ignore Ticketmaster's own
 * `fallback: true` flag, so events with no real uploaded poster got a generic
 * genre stock photo (e.g. "spotlights" for every unposted comedy show)
 * promoted to `events.imageUrl` as if it were the real one. Corrects already-
 * ingested rows from the `raw` payload already on disk — makes zero
 * Ticketmaster API calls.
 */
async function stepFixPosterFallback(db: Db): Promise<void> {
  const rows = await db
    .select({ id: sourceEvents.id, imageUrl: sourceEvents.imageUrl, raw: sourceEvents.raw })
    .from(sourceEvents)
    .where(eq(sourceEvents.source, "ticketmaster"));

  let sourceEventsFixed = 0;
  for (const row of rows) {
    const raw = row.raw as { images?: TmImage[] } | null;
    const corrected = pickImage(raw?.images);
    if (corrected === row.imageUrl) continue;
    await db.update(sourceEvents).set({ imageUrl: corrected }).where(eq(sourceEvents.id, row.id));
    sourceEventsFixed++;
  }
  console.log(`[worker] fix-poster-fallback: ${sourceEventsFixed} source_events corrected`);

  // Clear the canonical column so the next resolve pass re-fills it from the
  // now-corrected source_events.imageUrl above (real poster, or null — never
  // clobbers a hand-curated event, since sourceAttribution only ever gets set
  // by ingestion in the first place).
  const cleared = await db
    .update(events)
    .set({ imageUrl: null })
    .where(eq(events.sourceAttribution, "ticketmaster"))
    .returning({ id: events.id });
  console.log(`[worker] fix-poster-fallback: ${cleared.length} events.imageUrl cleared for re-enrichment`);

  await resolveSourceEvents(db);
}

async function runStep(step: string): Promise<void> {
  console.log(`[worker] step "${step}" started ${new Date().toISOString()}`);
  switch (step) {
    case "pull": {
      const c = await stepPull(db);
      console.log(`[worker] pull: ${c.sourceEventsUpserted} upserted, ${c.requests} API calls`);
      break;
    }
    case "resolve":
      await resolveSourceEvents(db);
      break;
    case "metrics": {
      // Record a run row so a standalone metrics run still lands in the history.
      const runId = await openRun(db, "metrics");
      const metrics = await stepMetrics(db);
      await finishRun(db, runId, { status: "success", metrics });
      break;
    }
    case "all":
      await runAll(db);
      break;
    case "fix-poster-fallback":
      await stepFixPosterFallback(db);
      break;
    default:
      throw new Error(`unknown --step "${step}" (use pull | resolve | metrics | all | fix-poster-fallback)`);
  }
  console.log(`[worker] step "${step}" finished ${new Date().toISOString()}`);
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

// `--step X` or `--once` → run once and exit (for manual runs / external
// orchestrators). Otherwise run as a daemon firing `all` on the daily schedule.
const stepArg = argValue("--step");
const runOnce = stepArg !== undefined || process.argv.includes("--once");

if (runOnce) {
  runStep(stepArg ?? "all")
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[worker] step failed:", err);
      process.exit(1);
    });
} else {
  // Daily at 05:00 Europe/Paris — before the morning traffic.
  cron.schedule(
    "0 5 * * *",
    () => {
      runStep("all").catch((err) => console.error("[worker] scheduled run failed:", err));
    },
    { timezone: "Europe/Paris" },
  );
  console.log("[worker] scheduled daily ingestion (all) at 05:00 Europe/Paris");
}
