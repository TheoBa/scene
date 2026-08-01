import cron from "node-cron";
import { events, type Db } from "@scenes/db";
import { createDb } from "@scenes/db";
import { and, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { ingestTicketmaster } from "./sources/ticketmaster.js";
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

// Same 20 slugs as packages/db/seed/index.ts's POSTER_SLUGS — the shows Théo
// hand-curated a poster for at launch (committed at apps/web/public/posters/
// <slug>.jpg). Kept as an inline copy rather than an import: apps/worker has
// no dependency on packages/db/seed (dev-only tooling), same reasoning as the
// backfill-script placement decision in docs/scenes-knowledge-base.md.
const CURATED_POSTER_SLUGS = [
  "anne-baquet-chante-au-paradis",
  "l-embarras-du-choix",
  "la-cantatrice-chauve",
  "le-petit-chaperon-rouge",
  "les-petites-femmes-de-maupassant",
  "petites-miseres-de-la-vie-conjugale",
  "bel-ami",
  "juliette-victor-hugo-mon-fol-amour",
  "odyssee-la-conference-musicale",
  "le-cercle-des-poetes-disparus",
  "les-miserables",
  "crime-et-chatiment",
  "le-silence-des-voix-qui-se-sont-tues",
  "la-lecon",
  "oublie-moi",
  "les-justes",
  "dernier-coup-de-ciseaux",
  "sand-chopin",
  "dolores",
  "memoires-d-hadrien",
];

/**
 * One-off fix (2026-08): `events.sourceAttribution` used to be one column
 * shared between two unrelated facts (who filled imageUrl vs. who filled
 * ticketUrl). A prior one-off step ("fix-poster-fallback", now removed) did a
 * blanket `imageUrl = null WHERE sourceAttribution = 'ticketmaster'`, which
 * wrongly nuked hand-curated posters on shows that separately picked up a
 * real Ticketmaster ticket link (that's what stamped sourceAttribution, not
 * the poster). Restores those posters and backfills the new split
 * `imageSource`/`ticketSource` columns from the old shared one. Idempotent —
 * safe to run more than once.
 */
async function stepFixPosterProvenance(db: Db): Promise<void> {
  // Restore first, and force imageSource back to null (curated, not
  // ingestion-filled) on these slugs — regardless of what the old shared
  // sourceAttribution column said, since it could only have been stamped
  // there by the ticketUrl side, never the poster.
  let restored = 0;
  for (const slug of CURATED_POSTER_SLUGS) {
    const rows = await db
      .update(events)
      .set({ imageUrl: `${slug}.jpg`, imageSource: null })
      .where(and(eq(events.slug, slug), isNull(events.imageUrl)))
      .returning({ id: events.id });
    restored += rows.length;
  }
  console.log(`[worker] fix-poster-provenance: ${restored} curated posters restored`);

  // ticketUrl is never hand-curated (no tool sets it manually today), so
  // backfilling from the old shared column is safe for every event.
  const ticketBackfilled = await db
    .update(events)
    .set({ ticketSource: sql`${events.sourceAttribution}` })
    .where(and(isNotNull(events.ticketUrl), isNull(events.ticketSource)))
    .returning({ id: events.id });

  // imageUrl backfill excludes the curated slugs above — everywhere else,
  // a non-null imageUrl only ever came from ingestion.
  const imageBackfilled = await db
    .update(events)
    .set({ imageSource: sql`${events.sourceAttribution}` })
    .where(
      and(
        isNotNull(events.imageUrl),
        isNull(events.imageSource),
        notInArray(events.slug, CURATED_POSTER_SLUGS),
      ),
    )
    .returning({ id: events.id });
  console.log(
    `[worker] fix-poster-provenance: ${imageBackfilled.length} imageSource backfilled, ` +
      `${ticketBackfilled.length} ticketSource backfilled`,
  );
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
    case "fix-poster-provenance":
      await stepFixPosterProvenance(db);
      break;
    default:
      throw new Error(`unknown --step "${step}" (use pull | resolve | metrics | all | fix-poster-provenance)`);
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
