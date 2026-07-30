/**
 * ingestion_runs helpers — the run log + metrics history that backs the
 * /dev/data-quality page. `openRun` marks a run in-flight; `finishRun` closes it
 * with the per-stage counts and (for the `all` flow) a metrics snapshot.
 */
import { ingestionRuns, type Db } from "@scenes/db";
import { eq } from "drizzle-orm";

export interface RunCounts {
  requests: number;
  fetched: number;
  sourceEventsUpserted: number;
  eventsUpserted: number;
  venuesUpserted: number;
  performancesUpserted: number;
}

export const emptyCounts = (): RunCounts => ({
  requests: 0,
  fetched: 0,
  sourceEventsUpserted: 0,
  eventsUpserted: 0,
  venuesUpserted: 0,
  performancesUpserted: 0,
});

/** Open a run row (`status='running'`); returns its id. */
export async function openRun(db: Db, source = "all"): Promise<string> {
  const [row] = await db
    .insert(ingestionRuns)
    .values({ source, status: "running" })
    .returning({ id: ingestionRuns.id });
  return row.id;
}

/** Close a run row with its final status, counts, optional error and metrics snapshot. */
export async function finishRun(
  db: Db,
  runId: string,
  opts: {
    status: "success" | "error";
    counts?: Partial<RunCounts>;
    error?: string;
    metrics?: unknown;
  },
): Promise<void> {
  await db
    .update(ingestionRuns)
    .set({
      status: opts.status,
      finishedAt: new Date(),
      error: opts.error ?? null,
      ...(opts.metrics !== undefined ? { metrics: opts.metrics } : {}),
      ...opts.counts,
    })
    .where(eq(ingestionRuns.id, runId));
}
