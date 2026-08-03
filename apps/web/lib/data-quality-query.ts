import { desc, isNotNull } from "drizzle-orm";
import { ingestionRuns } from "@scenes/db";
import { getDb } from "./db";

// Server-only read side of the ingestion metrics (touches the DB). Powers
// /dev/data-quality. The coverage snapshot is computed by the worker at run end
// and stored as jsonb on ingestion_runs, so the page just reads the latest one
// rather than re-running the aggregate here. Shapes mirror apps/worker/src/
// metrics.ts (kept in sync by hand — the two apps don't import each other).

export interface Coverage {
  present: number;
  total: number;
  pct: number; // 0..1
}

export interface SourceStats {
  source: string;
  rows: number;
  events: number;
  resolved: number;
  unresolved: number;
  stale: number;
}

export interface MetricsSnapshot {
  generatedAt: string;
  events: {
    total: number;
    coverage: Record<
      "imageUrl" | "author" | "director" | "durationMinutes" | "officialUrl" | "tags" | "ticketUrl",
      Coverage
    >;
  };
  venues: {
    total: number;
    address: Coverage;
    bio: Coverage;
    imageUrl: Coverage;
    officialUrl: Coverage;
    lat: Coverage;
    claimed: Coverage;
  };
  artists: {
    total: number;
    bio: Coverage;
    imageUrl: Coverage;
    officialUrl: Coverage;
    claimed: Coverage;
    linkedToEvent: Coverage;
  };
  performances: { total: number; upcoming: number; past: number };
  sources: SourceStats[];
}

export interface SourceBreakdown {
  source: string;
  inserted: number;
  enhanced: number;
  modified: number;
  unchanged: number;
}

export interface RunRow {
  id: string;
  source: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  requests: number;
  fetched: number;
  sourceEventsUpserted: number;
  eventsUpserted: number;
  venuesUpserted: number;
  performancesUpserted: number;
  artistsUpserted: number;
  error: string | null;
  sourceBreakdown: SourceBreakdown[] | null;
}

export interface DataQuality {
  metrics: MetricsSnapshot | null;
  metricsAt: Date | null; // when the run behind `metrics` started
  runs: RunRow[];
}

export async function getDataQuality(): Promise<DataQuality> {
  const db = getDb();

  const runs = await db
    .select({
      id: ingestionRuns.id,
      source: ingestionRuns.source,
      status: ingestionRuns.status,
      startedAt: ingestionRuns.startedAt,
      finishedAt: ingestionRuns.finishedAt,
      requests: ingestionRuns.requests,
      fetched: ingestionRuns.fetched,
      sourceEventsUpserted: ingestionRuns.sourceEventsUpserted,
      eventsUpserted: ingestionRuns.eventsUpserted,
      venuesUpserted: ingestionRuns.venuesUpserted,
      performancesUpserted: ingestionRuns.performancesUpserted,
      artistsUpserted: ingestionRuns.artistsUpserted,
      error: ingestionRuns.error,
      sourceBreakdown: ingestionRuns.sourceBreakdown,
    })
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(20);

  // Latest run that actually carries a coverage snapshot.
  const [latest] = await db
    .select({ metrics: ingestionRuns.metrics, startedAt: ingestionRuns.startedAt })
    .from(ingestionRuns)
    .where(isNotNull(ingestionRuns.metrics))
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(1);

  return {
    metrics: normalizeMetrics(latest?.metrics),
    metricsAt: latest?.startedAt ?? null,
    runs: runs.map((r) => ({ ...r, sourceBreakdown: r.sourceBreakdown as SourceBreakdown[] | null })),
  };
}

const ZERO_COVERAGE: Coverage = { present: 0, total: 0, pct: 0 };

// `metrics` is a jsonb snapshot written by whatever worker code ran the LAST
// ingestion — it can be older than the page rendering it (e.g. right after a
// deploy that added a new tracked field, before the next 05:00 cron run
// regenerates the snapshot). Filling in zero-Coverage for any field an older
// snapshot doesn't have keeps the page rendering instead of crashing on
// `undefined.pct`.
function normalizeMetrics(raw: unknown): MetricsSnapshot | null {
  if (!raw) return null;
  const m = raw as MetricsSnapshot;
  return {
    ...m,
    venues: {
      ...m.venues,
      officialUrl: m.venues.officialUrl ?? ZERO_COVERAGE,
      lat: m.venues.lat ?? ZERO_COVERAGE,
    },
    artists: {
      ...m.artists,
      officialUrl: m.artists.officialUrl ?? ZERO_COVERAGE,
    },
  };
}
