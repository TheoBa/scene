import { sourceEvents, type Db } from "@scenes/db";
import { and, eq } from "drizzle-orm";
import { ThrottledClient, BudgetExceededError, type Budget } from "../lib/http.js";

/**
 * Ticketmaster Discovery → `source_events` (the TS port of scripts/ingestion/
 * ticketmaster/pull.py). See docs/ingestion_ticketmaster.md.
 *
 * Structural constraints handled here:
 * - Deep-paging cap: the API only returns up to the 1000th item (`page*size<1000`),
 *   so we PARTITION by date window and, if a window still exceeds the cap,
 *   ADAPTIVELY BISECT it until each slice fits — no misses, no manual tuning.
 * - Rate limits (5 req/s, 5000/day): the ThrottledClient spaces + budget-caps calls.
 *
 * We land raw records in the staging table (upsert on (source, sourceRef), bumping
 * lastSeenAt); the resolve step turns them into canonical events/venues/performances.
 */

const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const SOURCE = "ticketmaster";
const PAGE_SIZE = 200; // API max
const MAX_PAGES = Math.floor(1000 / PAGE_SIZE); // deep-paging cap: pages 0..4
const CAP = 1000; // deep-paging item ceiling

// Theatre-relevant genres in segment "Arts et Théâtre" (KZFzniwnSyZfZ7v7na), which
// is otherwise noisy (its "Culturel" genre is museum exhibitions). Resolved live
// 2026-07-29, locale=fr. See docs/ingestion_ticketmaster.md §4.5.
export const GENRES: Record<string, string> = {
  KnvZfZ7v7l1: "Théâtre",
  KnvZfZ7v7na: "Théâtre pour enfants",
  KnvZfZ7v7ld: "Théâtre - Divers",
  KnvZfZ7vAe1: "Humour", // café-théâtre / one-man-show — core Paris
  KnvZfZ7v7lF: "Marionettes",
};
const DEFAULT_GENRE_IDS = Object.keys(GENRES).join(",");

export interface TicketmasterOptions {
  city: string;
  countryCode: string;
  locale: string;
  genreIds: string;
  horizonDays: number; // how far ahead to sweep
  windowDays: number; // initial partition size (auto-bisected past the cap)
  budget: Budget;
}

const DEFAULTS: Omit<TicketmasterOptions, "budget"> = {
  city: "Paris",
  countryCode: "FR",
  locale: "fr",
  genreIds: DEFAULT_GENRE_IDS,
  horizonDays: 120,
  windowDays: 7,
};

// ---- Minimal shape of the bits of a Discovery event we read (rest kept in `raw`) ----
export interface TmImage {
  url?: string;
  width?: number;
  height?: number;
  fallback?: boolean; // TM's own generic stock photo for the genre/venue, not a real poster
}
interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  images?: TmImage[];
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string } };
  classifications?: Array<{
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
      postalCode?: string;
      location?: { latitude?: string; longitude?: string };
    }>;
    attractions?: Array<{ name?: string }>;
  };
}
interface TmResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements?: number; totalPages?: number };
}

/** Per-row upsert classification, tallied across a sweep for /dev/data-quality. */
export interface UpsertTally {
  inserted: number; // sourceRef not seen before
  enhanced: number; // re-seen, some previously-null tracked field got filled
  modified: number; // re-seen, some previously-populated tracked field changed value
  unchanged: number; // re-seen, no tracked field differs
}

const emptyTally = (): UpsertTally => ({ inserted: 0, enhanced: 0, modified: 0, unchanged: 0 });

export interface SweepResult extends UpsertTally {
  upserted: number;
  fetched: number;
  requests: number;
}

// ---- date helpers (UTC; Discovery wants literal-Z ISO with no millis) ----
const DAY_MS = 86_400_000;
const isoZ = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);
const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const norm = (s: string): string => s.trim().toLowerCase();

/** TM reports venue coordinates as strings; guards against a missing/malformed value. */
function toCoord(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function windowQuery(o: TicketmasterOptions, key: string, start: Date, end: Date): Record<string, string> {
  const q: Record<string, string> = {
    apikey: key,
    countryCode: o.countryCode,
    locale: o.locale,
    sort: "date,asc",
    startDateTime: isoZ(start),
    endDateTime: isoZ(end),
  };
  if (o.city) q.city = o.city;
  if (o.genreIds) q.genreId = o.genreIds; // theatre genres — dodges the Culturel noise
  return q;
}

const buildUrl = (q: Record<string, string>): string => `${BASE_URL}?${new URLSearchParams(q).toString()}`;

/**
 * Widest non-fallback image is the closest to a usable poster; TM mixes many
 * crops/sizes. `fallback: true` means TM had no real image for this event and
 * substituted a generic stock photo for its genre (e.g. a stock "spotlights"
 * shot for every unposted comedy show) — never treat that as the poster.
 */
export function pickImage(images: TmImage[] | undefined): string | null {
  if (!images?.length) return null;
  let best: TmImage | undefined;
  for (const img of images) {
    if (!img.url || img.fallback) continue;
    if (!best || (img.width ?? 0) > (best.width ?? 0)) best = img;
  }
  return best?.url ?? null;
}

function mapEvent(e: TmEvent) {
  const venue = e._embedded?.venues?.[0];
  const cls = e.classifications?.[0];
  const localDate = e.dates?.start?.localDate ?? null;
  const title = e.name ?? null;
  const venueName = venue?.name ?? null;
  const dedupKey =
    title && venueName && localDate ? `${norm(title)}|${norm(venueName)}|${localDate}` : null;
  const performers = (e._embedded?.attractions ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n));
  return {
    source: SOURCE,
    sourceRef: e.id,
    sourceUrl: e.url ?? null,
    raw: e,
    title,
    venueName,
    venueAddress: venue?.address?.line1 ?? null,
    city: venue?.city?.name ?? null,
    postalCode: venue?.postalCode ?? null,
    venueLat: toCoord(venue?.location?.latitude),
    venueLng: toCoord(venue?.location?.longitude),
    startsAt: e.dates?.start?.dateTime ? new Date(e.dates.start.dateTime) : null,
    genre: cls?.genre?.name ?? null,
    subGenre: cls?.subGenre?.name ?? null,
    imageUrl: pickImage(e.images),
    performers: performers.length ? performers : null,
    dedupKey,
  };
}

// Fields compared to classify a re-seen row (excludes raw/dedupKey — dedupKey
// is derived from title/venueName/startsAt, already tracked individually).
const TRACKED_FIELDS = [
  "title",
  "venueName",
  "venueAddress",
  "city",
  "postalCode",
  "venueLat",
  "venueLng",
  "genre",
  "subGenre",
  "imageUrl",
  "sourceUrl",
] as const;

type ExistingRow = Pick<typeof sourceEvents.$inferSelect, (typeof TRACKED_FIELDS)[number] | "startsAt" | "performers">;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = (a as string[] | null) ?? [];
    const bb = (b as string[] | null) ?? [];
    return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
  }
  return (a ?? null) === (b ?? null);
}

/** New / unchanged / enhanced (null→value) / modified (value→different value). */
function classify(existing: ExistingRow | undefined, next: ReturnType<typeof mapEvent>): keyof UpsertTally {
  if (!existing) return "inserted";

  let enhanced = false;
  let modified = false;
  const note = (wasNull: boolean) => (wasNull ? (enhanced = true) : (modified = true));

  for (const field of TRACKED_FIELDS) {
    if (!valuesEqual(existing[field], next[field])) note(existing[field] === null);
  }
  const oldStartsAt = existing.startsAt?.getTime() ?? null;
  const newStartsAt = next.startsAt?.getTime() ?? null;
  if (oldStartsAt !== newStartsAt) note(oldStartsAt === null);
  if (!valuesEqual(existing.performers, next.performers)) note(existing.performers === null);

  if (modified) return "modified";
  if (enhanced) return "enhanced";
  return "unchanged";
}

/** Upsert one raw event; refresh mapped fields + lastSeenAt on re-see. */
async function upsertEvent(db: Db, e: TmEvent): Promise<keyof UpsertTally> {
  const row = mapEvent(e);
  const { source: _s, sourceRef: _r, ...mutable } = row;

  const [existing] = await db
    .select({
      title: sourceEvents.title,
      venueName: sourceEvents.venueName,
      venueAddress: sourceEvents.venueAddress,
      city: sourceEvents.city,
      postalCode: sourceEvents.postalCode,
      venueLat: sourceEvents.venueLat,
      venueLng: sourceEvents.venueLng,
      startsAt: sourceEvents.startsAt,
      genre: sourceEvents.genre,
      subGenre: sourceEvents.subGenre,
      imageUrl: sourceEvents.imageUrl,
      sourceUrl: sourceEvents.sourceUrl,
      performers: sourceEvents.performers,
    })
    .from(sourceEvents)
    .where(and(eq(sourceEvents.source, row.source), eq(sourceEvents.sourceRef, row.sourceRef)));
  const outcome = classify(existing, row);

  await db
    .insert(sourceEvents)
    .values(row)
    .onConflictDoUpdate({
      target: [sourceEvents.source, sourceEvents.sourceRef],
      set: { ...mutable, lastSeenAt: new Date() },
    });

  return outcome;
}

/** size=1 probe → totalElements, to decide whether a window needs bisecting. */
async function countWindow(client: ThrottledClient, q: Record<string, string>): Promise<number> {
  const data = await client.getJson<TmResponse>(buildUrl({ ...q, size: "1", page: "0" }));
  return data.page?.totalElements ?? 0;
}

/** Page through a window known to fit the cap; upsert each event, tallying outcomes. */
async function saveWindow(
  db: Db,
  client: ThrottledClient,
  q: Record<string, string>,
  tally: UpsertTally,
): Promise<number> {
  let fetched = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await client.getJson<TmResponse>(buildUrl({ ...q, size: String(PAGE_SIZE), page: String(page) }));
    const events = data._embedded?.events ?? [];
    for (const e of events) {
      tally[await upsertEvent(db, e)]++;
      fetched++;
    }
    const totalPages = data.page?.totalPages ?? 0;
    if (events.length === 0 || page + 1 >= totalPages) break;
  }
  return fetched;
}

/** Adaptive: bisect any window over the cap until each slice fits. */
async function processWindow(
  db: Db,
  client: ThrottledClient,
  key: string,
  o: TicketmasterOptions,
  start: Date,
  end: Date,
  tally: UpsertTally,
): Promise<number> {
  const q = windowQuery(o, key, start, end);
  const total = await countWindow(client, q);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const label = `${ymd(start)}→${ymd(end)}`;

  if (total > CAP && days > 1) {
    const mid = addDays(start, Math.floor(days / 2)); // days>1 ⇒ mid strictly inside
    console.log(`  ${label}: ${total} > cap — splitting`);
    return (
      (await processWindow(db, client, key, o, start, mid, tally)) +
      (await processWindow(db, client, key, o, mid, end, tally))
    );
  }

  const fetched = await saveWindow(db, client, q, tally);
  if (total > CAP) console.warn(`  ⚠ ${label}: ${total} > cap at 1-day floor — some events missed`);
  else console.log(`  ${label}: ${fetched} events`);
  return fetched;
}

/**
 * Sweep Paris theatre events into `source_events`. Owns its own throttled client
 * (so it manages its own rate budget); a BudgetExceededError ends the sweep
 * cleanly with a partial-but-saved result.
 */
export async function ingestTicketmaster(
  db: Db,
  budget: Budget,
  opts: Partial<Omit<TicketmasterOptions, "budget">> = {},
): Promise<SweepResult> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) {
    console.warn("[ticketmaster] TICKETMASTER_API_KEY not set — skipping this source");
    return { upserted: 0, fetched: 0, requests: 0, ...emptyTally() };
  }
  const o: TicketmasterOptions = { ...DEFAULTS, ...opts, budget };
  const client = new ThrottledClient(budget);

  const start = startOfUtcDay(new Date());
  const end = addDays(start, o.horizonDays);
  const genreNames = o.genreIds
    ? o.genreIds
        .split(",")
        .map((g) => GENRES[g] ?? g)
        .join(", ")
    : "(all)";
  console.log(
    `[ticketmaster] sweeping ${ymd(start)}→${ymd(end)} in ${o.windowDays}d windows ` +
      `(auto-bisected past the cap) | city=${o.city} country=${o.countryCode} | genres=[${genreNames}]`,
  );

  let fetched = 0;
  let cursor = start;
  const tally = emptyTally();
  try {
    while (cursor < end) {
      const winEnd = new Date(Math.min(addDays(cursor, o.windowDays).getTime(), end.getTime()));
      fetched += await processWindow(db, client, key, o, cursor, winEnd, tally);
      cursor = winEnd;
    }
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.warn(`[ticketmaster] ${err.message} — partial sweep saved, resumes next run`);
    } else {
      throw err;
    }
  }

  // Every row we touched is an upsert into source_events; fetched == upserted here.
  console.log(
    `[ticketmaster] ${fetched} source_events upserted (${client.requests} API calls) — ` +
      `${tally.inserted} new, ${tally.enhanced} enhanced, ${tally.modified} modified, ${tally.unchanged} unchanged`,
  );
  return { upserted: fetched, fetched, requests: client.requests, ...tally };
}
