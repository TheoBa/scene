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
      "imageUrl" | "author" | "director" | "durationMinutes" | "officialUrl" | "tags",
      Coverage
    >;
  };
  venues: { total: number; address: Coverage; bio: Coverage; imageUrl: Coverage; claimed: Coverage };
  artists: { total: number; bio: Coverage; imageUrl: Coverage; claimed: Coverage; linkedToEvent: Coverage };
  performances: { total: number; upcoming: number; past: number };
  sources: SourceStats[];
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
    metrics: (latest?.metrics as MetricsSnapshot | undefined) ?? null,
    metricsAt: latest?.startedAt ?? null,
    runs,
  };
}
