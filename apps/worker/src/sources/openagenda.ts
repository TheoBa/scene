import type { Db } from "@scenes/db";
import { pieces, venues } from "@scenes/db";
import type { NormalizedPiece, NormalizedVenue } from "./types.js";
import { pickLang, shortHash, slugify } from "../lib/text.js";

/**
 * OpenAgenda — open licence, schema.org events. No approval needed, so this is
 * the source that validates the whole pipeline shape (fetch → normalize → upsert
 * → provenance) and feeds the Phase-1 coverage audit.
 *
 * API: GET https://api.openagenda.com/v2/agendas/{agendaUID}/events
 * Docs: https://developers.openagenda.com/evenements/lecture/
 * Auth: public read key in `?key=` (env OPENAGENDA_API_KEY).
 * Config: OPENAGENDA_AGENDA_UIDS — comma-separated Paris theatre agenda UIDs.
 */

const OA_BASE = "https://api.openagenda.com/v2";
const SOURCE = "openagenda";
const MAX_SIZE = 300; // API hard cap per page

// --- Raw API shapes (only the fields we consume; the API returns more) ---

type OaText = string | Record<string, string>;

interface OaLocation {
  uid?: number;
  name?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface OaTiming {
  begin?: string;
  end?: string;
}

interface OaEvent {
  uid: number | string;
  slug?: string;
  title?: OaText;
  description?: OaText;
  longDescription?: OaText;
  image?: { base?: string; filename?: string } | string | null;
  firstTiming?: OaTiming | null;
  lastTiming?: OaTiming | null;
  location?: OaLocation | null;
}

interface OaEventsResponse {
  total?: number;
  events?: OaEvent[];
  after?: string[] | null;
}

export interface OpenAgendaOptions {
  key?: string;
  agendaUids?: string[];
  /** Live catalogue by default — current + upcoming, not past events. */
  relative?: string[];
  size?: number;
}

function getConfig(opts: OpenAgendaOptions) {
  const key = opts.key ?? process.env.OPENAGENDA_API_KEY;
  const agendaUids =
    opts.agendaUids ??
    (process.env.OPENAGENDA_AGENDA_UIDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ??
      []);
  const size = Math.min(opts.size ?? MAX_SIZE, MAX_SIZE);
  const relative = opts.relative ?? ["current", "upcoming"];
  return { key, agendaUids, size, relative };
}

/** Page through one agenda using the `after` cursor until it comes back empty. */
async function fetchAgendaEvents(
  agendaUid: string,
  key: string,
  size: number,
  relative: string[],
): Promise<OaEvent[]> {
  const events: OaEvent[] = [];
  let after: string[] | null = null;

  for (;;) {
    const url = new URL(`${OA_BASE}/agendas/${agendaUid}/events`);
    url.searchParams.set("key", key);
    url.searchParams.set("size", String(size));
    url.searchParams.set("detailed", "1");
    url.searchParams.set("monolingual", "fr");
    for (const r of relative) url.searchParams.append("relative[]", r);
    if (after) for (const a of after) url.searchParams.append("after[]", a);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `OpenAgenda agenda ${agendaUid}: HTTP ${res.status} ${res.statusText}`,
      );
    }
    const body = (await res.json()) as OaEventsResponse;
    const page = body.events ?? [];
    events.push(...page);

    // `after` is null (or the page is empty) once we've drained the agenda.
    if (page.length === 0 || !body.after || body.after.length === 0) break;
    after = body.after;
  }

  return events;
}

function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function imageUrl(image: OaEvent["image"]): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (image.base && image.filename) return `${image.base}${image.filename}`;
  return undefined;
}

function normalizeVenue(loc?: OaLocation | null): NormalizedVenue | undefined {
  const name = loc?.name?.trim();
  if (!name) return undefined;
  return {
    name,
    address: loc?.address?.trim(),
    city: loc?.city?.trim(),
    lat: loc?.latitude ?? undefined,
    lng: loc?.longitude ?? undefined,
  };
}

function normalizeEvent(e: OaEvent): NormalizedPiece | null {
  const title = pickLang(e.title)?.trim();
  if (!title) return null; // nothing usable without a title

  return {
    title,
    synopsis: pickLang(e.longDescription) ?? pickLang(e.description),
    imageUrl: imageUrl(e.image),
    startDate: toIsoDate(e.firstTiming?.begin),
    endDate: toIsoDate(e.lastTiming?.end),
    source: SOURCE,
    sourceRef: String(e.uid),
    venue: normalizeVenue(e.location),
  };
}

/**
 * Fetch + normalize OpenAgenda events. DB-free, so the coverage audit can reuse
 * it without touching Postgres. Returns [] (with a warning) when unconfigured —
 * matching the graceful no-op the worker expects from an un-keyed source.
 */
export async function fetchOpenAgendaEvents(
  opts: OpenAgendaOptions = {},
): Promise<NormalizedPiece[]> {
  const { key, agendaUids, size, relative } = getConfig(opts);
  if (!key || agendaUids.length === 0) {
    console.warn(
      "[openagenda] OPENAGENDA_API_KEY or OPENAGENDA_AGENDA_UIDS not set — skipping.",
    );
    return [];
  }

  const all: NormalizedPiece[] = [];
  for (const agendaUid of agendaUids) {
    const raw = await fetchAgendaEvents(agendaUid, key, size, relative);
    for (const e of raw) {
      const n = normalizeEvent(e);
      if (n) all.push(n);
    }
  }
  return all;
}

/** Upsert a venue by slug; returns its id. TODO(dedup): two distinct venues that
 *  normalize to the same name will merge — acceptable until entity resolution lands. */
async function upsertVenue(db: Db, v: NormalizedVenue): Promise<string> {
  const [row] = await db
    .insert(venues)
    .values({
      name: v.name,
      slug: slugify(v.name),
      address: v.address,
      city: v.city ?? "Paris",
      lat: v.lat,
      lng: v.lng,
    })
    .onConflictDoUpdate({
      target: venues.slug,
      set: { name: v.name, address: v.address, lat: v.lat, lng: v.lng },
    })
    .returning({ id: venues.id });
  return row.id;
}

/** Upsert a piece keyed on (source, sourceRef) — the provenance index. The slug
 *  carries a source-ref hash so it stays unique and stable across re-ingests. */
async function upsertPiece(
  db: Db,
  p: NormalizedPiece,
  venueId: string | null,
): Promise<void> {
  const slug = `${slugify(p.title)}-${shortHash(`${p.source}:${p.sourceRef}`)}`;
  await db
    .insert(pieces)
    .values({
      title: p.title,
      slug,
      synopsis: p.synopsis,
      venueId,
      startDate: p.startDate,
      endDate: p.endDate,
      imageUrl: p.imageUrl,
      source: p.source,
      sourceRef: p.sourceRef,
    })
    .onConflictDoUpdate({
      target: [pieces.source, pieces.sourceRef],
      set: {
        title: p.title,
        synopsis: p.synopsis,
        venueId,
        startDate: p.startDate,
        endDate: p.endDate,
        imageUrl: p.imageUrl,
        updatedAt: new Date(),
      },
    });
}

export async function ingestOpenAgenda(db: Db): Promise<{ upserted: number }> {
  const items = await fetchOpenAgendaEvents();
  let upserted = 0;
  for (const item of items) {
    const venueId = item.venue ? await upsertVenue(db, item.venue) : null;
    await upsertPiece(db, item, venueId);
    upserted++;
  }
  return { upserted };
}
