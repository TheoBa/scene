import { events, performances, sourceEvents, venues, type Db } from "@scenes/db";
import { count, sql } from "drizzle-orm";

/**
 * Data-quality / completion snapshot over the canonical catalogue + the staging
 * layer. Stored as jsonb on the ingestion run and rendered by /dev/data-quality,
 * so Théo can see at a glance where enrichment effort should go (e.g. "posters
 * present on 1%"). Kept as a plain serialisable object — the shape below is the
 * page's contract.
 */

/** Coverage of one optional field: how many rows have it populated. */
export interface Coverage {
  present: number;
  total: number;
  pct: number; // present / total, 0..1, 3dp
}

export interface SourceStats {
  source: string;
  rows: number; // staging records
  events: number; // distinct canonical events they resolved to
  resolved: number; // rows linked to a performance
  unresolved: number;
  stale: number; // not re-seen in the last 7 days
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
  venues: { total: number; address: Coverage };
  performances: { total: number; upcoming: number; past: number };
  sources: SourceStats[];
}

const cov = (present: number, total: number): Coverage => ({
  present,
  total,
  pct: total ? Math.round((present / total) * 1000) / 1000 : 0,
});

export async function computeMetrics(db: Db): Promise<MetricsSnapshot> {
  // count(col) counts non-null values; the tags filter needs a raw predicate.
  const [ev] = await db
    .select({
      total: count(),
      imageUrl: count(events.imageUrl),
      author: count(events.author),
      director: count(events.director),
      durationMinutes: count(events.durationMinutes),
      officialUrl: count(events.officialUrl),
      tags: sql<number>`count(*) filter (where cardinality(${events.tags}) > 0)::int`,
    })
    .from(events);

  const [vn] = await db
    .select({ total: count(), address: count(venues.address) })
    .from(venues);

  const [pf] = await db
    .select({
      total: count(),
      upcoming: sql<number>`count(*) filter (where ${performances.startsAt} >= now())::int`,
    })
    .from(performances);

  const bySource = await db
    .select({
      source: sourceEvents.source,
      rows: count(),
      events: sql<number>`count(distinct ${sourceEvents.eventId})::int`,
      resolved: sql<number>`count(*) filter (where ${sourceEvents.performanceId} is not null)::int`,
      stale: sql<number>`count(*) filter (where ${sourceEvents.lastSeenAt} < now() - interval '7 days')::int`,
    })
    .from(sourceEvents)
    .groupBy(sourceEvents.source);

  return {
    generatedAt: new Date().toISOString(),
    events: {
      total: ev.total,
      coverage: {
        imageUrl: cov(ev.imageUrl, ev.total),
        author: cov(ev.author, ev.total),
        director: cov(ev.director, ev.total),
        durationMinutes: cov(ev.durationMinutes, ev.total),
        officialUrl: cov(ev.officialUrl, ev.total),
        tags: cov(ev.tags, ev.total),
      },
    },
    venues: { total: vn.total, address: cov(vn.address, vn.total) },
    performances: { total: pf.total, upcoming: pf.upcoming, past: pf.total - pf.upcoming },
    sources: bySource.map((s) => ({
      source: s.source,
      rows: s.rows,
      events: s.events,
      resolved: s.resolved,
      unresolved: s.rows - s.resolved,
      stale: s.stale,
    })),
  };
}

/** One-line-ish log so a run's coverage is visible in the worker output. */
export function logMetrics(m: MetricsSnapshot): void {
  const pct = (c: Coverage) => `${Math.round(c.pct * 100)}%`;
  console.log(
    `[metrics] ${m.events.total} events · ${m.venues.total} venues · ${m.performances.total} ` +
      `performances (${m.performances.upcoming} upcoming)`,
  );
  console.log(
    `[metrics] coverage — posters ${pct(m.events.coverage.imageUrl)} · ` +
      `author ${pct(m.events.coverage.author)} · director ${pct(m.events.coverage.director)} · ` +
      `duration ${pct(m.events.coverage.durationMinutes)} · address ${pct(m.venues.address)}`,
  );
  for (const s of m.sources) {
    console.log(
      `[metrics] source ${s.source}: ${s.rows} rows → ${s.events} events ` +
        `(${s.unresolved} unresolved, ${s.stale} stale)`,
    );
  }
}
