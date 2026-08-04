import { count, desc, isNotNull, sql } from "drizzle-orm";
import { artists, eventArtists, ingestionRuns, venues } from "@scenes/db";
import { getDb } from "./db";

// Server-only read side of the ingestion metrics (touches the DB). Powers
// /dev/data-quality. Events/performances/sources coverage only ever changes via
// ingestion, so that part is a snapshot the worker computes at run end and
// stores as jsonb on ingestion_runs — cheap to just read the latest one.
// Venues/artists coverage is queried live here instead: those tables are also
// written by one-off backfill scripts (geocoding, curated-list enrichment,
// Wikidata bios) that run outside the ingestion pipeline, so a cached
// ingestion-run snapshot would silently go stale after every such backfill.
// Shapes mirror apps/worker/src/metrics.ts (kept in sync by hand — the two
// apps don't import each other).

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

  const metrics = normalizeMetrics(latest?.metrics);
  if (metrics) {
    metrics.venues = await getVenueCoverage(db);
    metrics.artists = await getArtistCoverage(db);
  }

  return {
    metrics,
    metricsAt: latest?.startedAt ?? null,
    runs: runs.map((r) => ({ ...r, sourceBreakdown: r.sourceBreakdown as SourceBreakdown[] | null })),
  };
}

const cov = (present: number, total: number): Coverage => ({
  present,
  total,
  pct: total ? Math.round((present / total) * 1000) / 1000 : 0,
});

async function getVenueCoverage(db: ReturnType<typeof getDb>): Promise<MetricsSnapshot["venues"]> {
  const [vn] = await db
    .select({
      total: count(),
      address: count(venues.address),
      bio: count(venues.bio),
      imageUrl: count(venues.imageUrl),
      officialUrl: count(venues.officialUrl),
      lat: count(venues.lat), // lat/lng are always written together — see backfill scripts
      claimed: count(venues.claimedByUserId),
    })
    .from(venues);

  return {
    total: vn.total,
    address: cov(vn.address, vn.total),
    bio: cov(vn.bio, vn.total),
    imageUrl: cov(vn.imageUrl, vn.total),
    officialUrl: cov(vn.officialUrl, vn.total),
    lat: cov(vn.lat, vn.total),
    claimed: cov(vn.claimed, vn.total),
  };
}

async function getArtistCoverage(db: ReturnType<typeof getDb>): Promise<MetricsSnapshot["artists"]> {
  const [ar] = await db
    .select({
      total: count(),
      bio: count(artists.bio),
      imageUrl: count(artists.imageUrl),
      officialUrl: count(artists.officialUrl),
      claimed: count(artists.claimedByUserId),
    })
    .from(artists);

  const [linked] = await db
    .select({ linked: sql<number>`count(distinct ${eventArtists.artistId})::int` })
    .from(eventArtists);

  return {
    total: ar.total,
    bio: cov(ar.bio, ar.total),
    imageUrl: cov(ar.imageUrl, ar.total),
    officialUrl: cov(ar.officialUrl, ar.total),
    claimed: cov(ar.claimed, ar.total),
    linkedToEvent: cov(linked.linked, ar.total),
  };
}

// `metrics` is a jsonb snapshot written by whatever worker code ran the LAST
// ingestion — it can be older than the page rendering it (e.g. right after a
// deploy that added a new tracked field, before the next 05:00 cron run
// regenerates the snapshot). Filling in zero-Coverage for any field an older
// snapshot doesn't have keeps the page rendering instead of crashing on
// `undefined.pct`. venues/artists get overwritten with live queries right
// after this by the caller, but still need placeholder shapes here in case an
// old snapshot is missing the key entirely.
const ZERO_COVERAGE: Coverage = { present: 0, total: 0, pct: 0 };
const ZERO_VENUES: MetricsSnapshot["venues"] = {
  total: 0,
  address: ZERO_COVERAGE,
  bio: ZERO_COVERAGE,
  imageUrl: ZERO_COVERAGE,
  officialUrl: ZERO_COVERAGE,
  lat: ZERO_COVERAGE,
  claimed: ZERO_COVERAGE,
};
const ZERO_ARTISTS: MetricsSnapshot["artists"] = {
  total: 0,
  bio: ZERO_COVERAGE,
  imageUrl: ZERO_COVERAGE,
  officialUrl: ZERO_COVERAGE,
  claimed: ZERO_COVERAGE,
  linkedToEvent: ZERO_COVERAGE,
};
function normalizeMetrics(raw: unknown): MetricsSnapshot | null {
  if (!raw) return null;
  const m = raw as MetricsSnapshot;
  return {
    ...m,
    venues: m.venues ?? ZERO_VENUES,
    artists: m.artists ?? ZERO_ARTISTS,
  };
}
