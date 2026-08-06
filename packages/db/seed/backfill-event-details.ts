// One-time bootstrap: fills `events.imageUrl`/`author`/`director`/
// `durationMinutes` and cast (`event_artists`) for upcoming, mostly
// Ticketmaster-sourced events that never got these fields from ingestion.
// Not a recurring source — run once against the current backlog, review,
// done. See docs/scenes-knowledge-base.md §13 decision log (2026-08-06)
// for the sourcing rationale, including the narrow billetreduc override.
//
// Per event, in order: (1) the venue's own official site — one LLM call
// finds the show's own page on that site; (2) theatre.info's site search
// (already the intended canonical catalogue source — Etalab open licence);
// (3) billetreduc's site search, as a narrow one-time-only exception to the
// 2026-07-18 retirement decision. Every candidate link is guarded by the
// same fuzzy title-match used in backfill-venue-curated-list.ts before
// being trusted. `ticketmaster.fr` (the URL already stored on
// `events.ticketUrl`) was tried first but returns HTTP 401 to a plain
// fetch — a deliberate anti-bot measure, not something this script
// attempts to work around; if theatre.info or billetreduc similarly block
// a plain fetch, the event is skipped and logged, same policy. Extraction
// is one LLM call per page with a strict schema; posterImageUrl and
// castMembers are verified as literal substrings of the fetched page
// before being trusted.
//
//   npm run backfill-event-details -w packages/db -- --dry-run --limit=15   (no writes, full pipeline)
//   npm run backfill-event-details -w packages/db -- --limit=20             (real run, capped)
//   npm run backfill-event-details -w packages/db                          (real run, full backlog)
//
// Flags: --dry-run, --days-ahead=60 (default), --limit=N, --skip-venue-site
// Needs DATABASE_URL and ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";
import { sql, eq } from "drizzle-orm";
import { artists, createDb, eventArtists, events, slugify, uniqueSlug, type Db } from "../src/index.js";

const MODEL = "claude-haiku-4-5";
const USER_AGENT = "ScenesBot/1.0 (https://scenes.badoz.org; one-off event-detail backfill)";
const FETCH_TIMEOUT_MS = 15_000;
const REQUEST_DELAY_MS = 200;
const MAX_HTML_CHARS = 60_000;
const MATCH_THRESHOLD = 0.75;

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_VENUE_SITE = process.argv.includes("--skip-venue-site");

function argValue(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}
const DAYS_AHEAD = Number(argValue("days-ahead") ?? "60");
const LIMIT = argValue("limit") !== undefined ? Number(argValue("limit")) : undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Fuzzy title matching (same core-tokens approach as
// backfill-venue-curated-list.ts, duplicated here — see that file for the
// real-bug rationale: full-name comparison is too permissive on generic
// words). Used to guard a model-proposed venue-site link against being
// confidently wrong. ----------

const STOPWORDS = new Set([
  "theatre",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "l",
  "et",
  "a",
  "au",
  "aux",
  "un",
  "une",
]);

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function coreTokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function coreSimilarity(a: string, b: string): number {
  const coreA = coreTokens(a).join(" ");
  const coreB = coreTokens(b).join(" ");
  if (coreA.length === 0 || coreB.length === 0) return 0;
  return similarity(coreA, coreB);
}

// ---------- Fetching ----------

function cleanHtml(html: string): string {
  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  return stripped.length > MAX_HTML_CHARS ? stripped.slice(0, MAX_HTML_CHARS) : stripped;
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) return null;
    return cleanHtml(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function safeResolveUrl(candidate: string, base: string): string | null {
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

// ---------- Search-based fallback sources ----------
// Real search-URL patterns (verified against each site's actual search
// form — not guessed): theatre.info's global search takes `sapi_fulltext`,
// billetreduc's header search takes `se`.

const THEATRE_INFO_SEARCH_URL = "https://www.theatre.info/recherche-globale";
const BILLETREDUC_SEARCH_URL = "https://www.billetreduc.com/search.htm";

function buildSearchUrl(base: string, param: string, query: string): string {
  const url = new URL(base);
  url.searchParams.set(param, query);
  return url.toString();
}

function normalizeForSubstring(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsLiteral(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return normalizeForSubstring(haystack).includes(normalizeForSubstring(needle));
}

// ---------- LLM: navigate a venue site, then extract event details ----------

const NAV_SCHEMA = {
  type: "object",
  properties: {
    url: { anyOf: [{ type: "string" }, { type: "null" }] },
    linkText: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["url", "linkText"],
  additionalProperties: false,
} as const;

interface NavResult {
  url: string | null;
  linkText: string | null;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    posterImageUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
    author: { anyOf: [{ type: "string" }, { type: "null" }] },
    director: { anyOf: [{ type: "string" }, { type: "null" }] },
    castMembers: { type: "array", items: { type: "string" } },
    durationMinutes: { anyOf: [{ type: "number" }, { type: "null" }] },
  },
  required: ["posterImageUrl", "author", "director", "castMembers", "durationMinutes"],
  additionalProperties: false,
} as const;

interface ExtractionResult {
  posterImageUrl: string | null;
  author: string | null;
  director: string | null;
  castMembers: string[];
  durationMinutes: number | null;
}

async function structuredCall<T>(
  client: Anthropic,
  system: string,
  userContent: string,
  schema: Record<string, unknown>,
): Promise<T | null> {
  // Structured outputs (schema-constrained JSON) live under the beta
  // messages endpoint in the installed SDK version — `output_format` on
  // `client.beta.messages.create`, not `output_config.format`.
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userContent }],
    output_format: { type: "json_schema", schema },
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text) as T;
  } catch {
    return null;
  }
}

async function findShowUrlOnListingPage(
  client: Anthropic,
  listingHtml: string,
  eventName: string,
): Promise<NavResult | null> {
  return structuredCall<NavResult>(
    client,
    "You are given the raw HTML of a web page (a theatre venue's site, or a search-results page on a theatre-listings site) and the title of a specific show. Find the URL of the page dedicated to that specific show, if one is confidently identifiable from a link on this page. Only return a URL that appears literally as a link (href) in the provided HTML — never construct or guess one. If no link is confidently about this exact show, return null for both fields. Also return the visible link/anchor text you matched, verbatim, so it can be verified against the show title.",
    `Show title: ${eventName}\n\nPage HTML:\n${listingHtml}`,
    NAV_SCHEMA,
  );
}

// Fetches a search-results page, has the model pick the matching show link
// (guarded by the same fuzzy-match threshold as the venue-site path), then
// fetches that show's own page. Returns null at any stage rather than
// guessing — including when the search page itself doesn't fetch (e.g. an
// anti-bot block), which is treated as "this source doesn't work", not
// retried or worked around.
async function findShowPageViaSearch(
  client: Anthropic,
  searchUrl: string,
  eventName: string,
): Promise<string | null> {
  const searchHtml = await fetchPage(searchUrl);
  await sleep(REQUEST_DELAY_MS);
  if (!searchHtml) return null;

  let nav: NavResult | null = null;
  try {
    nav = await findShowUrlOnListingPage(client, searchHtml, eventName);
  } catch (err) {
    console.warn(`[backfill-event-details] search-page nav call failed for "${eventName}" (${searchUrl}):`, err);
    return null;
  }
  if (!nav?.url || !nav.linkText || coreSimilarity(nav.linkText, eventName) < MATCH_THRESHOLD) return null;

  const resolvedUrl = safeResolveUrl(nav.url, searchUrl);
  if (!resolvedUrl) return null;

  const showHtml = await fetchPage(resolvedUrl);
  await sleep(REQUEST_DELAY_MS);
  return showHtml;
}

async function extractEventDetails(
  client: Anthropic,
  pageHtml: string,
  eventName: string,
  venueName: string,
): Promise<ExtractionResult | null> {
  return structuredCall<ExtractionResult>(
    client,
    "You are given the raw HTML of a page about a specific theatre show. Extract only information that is literally present in the provided content — never infer, guess, or use outside knowledge of this show or any similar show. If a field is not explicitly present, return null (or an empty array for castMembers) — that is the correct answer when information is missing. For posterImageUrl: only return a URL that literally appears in the content (an <img src>, an og:image meta tag, or equivalent) — never construct or infer one. For durationMinutes: only return a value if the page explicitly states a duration (e.g. '1h30', '90 minutes', 'durée : 1h20'), converted to minutes — never estimate from genre or type. For castMembers: literal names from a cast/distribution list only.",
    `Show title: ${eventName}\nVenue: ${venueName}\n\nPage HTML:\n${pageHtml}`,
    EXTRACTION_SCHEMA,
  );
}

// ---------- Cast linking (same upsert-by-name pattern as seed/index.ts /
// apps/worker/src/enrich.ts, inlined here since this script isn't shaped
// around sourceEvents rows) ----------

async function upsertAndLinkArtists(
  db: Db,
  eventId: string,
  names: string[],
): Promise<{ created: number; linked: number }> {
  const trimmed = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (trimmed.length === 0) return { created: 0, linked: 0 };

  const existingArtists = await db.select({ id: artists.id, name: artists.name, slug: artists.slug }).from(artists);
  const takenSlugs = new Set(existingArtists.map((a) => a.slug));
  const idByName = new Map(existingArtists.map((a) => [a.name, a.id]));

  const newNames = trimmed.filter((n) => !idByName.has(n));
  let created = 0;
  if (newNames.length) {
    const inserted = await db
      .insert(artists)
      .values(
        newNames.map((name) => {
          const slug = uniqueSlug(slugify(name), takenSlugs);
          takenSlugs.add(slug);
          return { name, slug };
        }),
      )
      .onConflictDoNothing()
      .returning({ id: artists.id, name: artists.name });
    created = inserted.length;
    for (const a of inserted) idByName.set(a.name, a.id);
  }

  const pairs = trimmed
    .map((name) => idByName.get(name))
    .filter((id): id is string => Boolean(id))
    .map((artistId) => ({ eventId, artistId }));

  let linked = 0;
  if (pairs.length) {
    const insertedLinks = await db.insert(eventArtists).values(pairs).onConflictDoNothing().returning({ id: eventArtists.id });
    linked = insertedLinks.length;
  }
  return { created, linked };
}

// ---------- Candidate query ----------
// Soonest upcoming performance per event within the window, joined to that
// performance's venue, plus whether the event already has any linked cast.

interface CandidateRow {
  eventId: string;
  eventName: string;
  eventSlug: string;
  author: string | null;
  director: string | null;
  durationMinutes: number | null;
  imageUrl: string | null;
  venueId: string;
  venueName: string;
  venueOfficialUrl: string | null;
  startsAt: string;
  noCast: boolean;
}

async function loadCandidates(db: Db): Promise<CandidateRow[]> {
  const result = await db.execute(sql`
    with soonest as (
      select distinct on (p.event_id)
        e.id as "eventId",
        e.name as "eventName",
        e.slug as "eventSlug",
        e.author as "author",
        e.director as "director",
        e.duration_minutes as "durationMinutes",
        e.image_url as "imageUrl",
        v.id as "venueId",
        v.name as "venueName",
        v.official_url as "venueOfficialUrl",
        p.starts_at as "startsAt"
      from events e
      join performances p on p.event_id = e.id
      join venues v on v.id = p.venue_id
      where p.starts_at between now() and now() + make_interval(days => ${DAYS_AHEAD})
      order by p.event_id, p.starts_at asc
    )
    select s.*,
      not exists (select 1 from event_artists ea where ea.event_id = s."eventId") as "noCast"
    from soonest s
    order by s."startsAt" asc
  `);
  return result.rows as unknown as CandidateRow[];
}

function needsWork(row: CandidateRow): boolean {
  return row.imageUrl === null || row.author === null || row.director === null || row.durationMinutes === null || row.noCast;
}

// ---------- Main ----------

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();
  const db = createDb();

  console.log(
    `[backfill-event-details] ${DRY_RUN ? "DRY RUN — no writes will be made" : "no --dry-run: WILL WRITE to the database"} (days-ahead=${DAYS_AHEAD}${LIMIT !== undefined ? `, limit=${LIMIT}` : ""}${SKIP_VENUE_SITE ? ", skip-venue-site" : ""})\n`,
  );

  const allCandidates = (await loadCandidates(db)).filter(needsWork);
  const candidates = LIMIT !== undefined ? allCandidates.slice(0, LIMIT) : allCandidates;
  console.log(`[backfill-event-details] ${candidates.length} of ${allCandidates.length} eligible events selected\n`);

  let enriched = 0;
  let venueSiteMatch = 0;
  let theatreInfoMatch = 0;
  let billetreducMatch = 0;
  let noSourceFound = 0;
  let artistsCreated = 0;
  let artistsLinked = 0;
  const fieldFillCounts = { imageUrl: 0, author: 0, director: 0, durationMinutes: 0, cast: 0 };

  for (const row of candidates) {
    let sourceHtml: string | null = null;
    let sourceLabel: "venue-site" | "theatre-info" | "billetreduc" | null = null;

    if (!SKIP_VENUE_SITE && row.venueOfficialUrl) {
      const venueHtml = await fetchPage(row.venueOfficialUrl);
      await sleep(REQUEST_DELAY_MS);
      if (venueHtml) {
        let nav: NavResult | null = null;
        try {
          nav = await findShowUrlOnListingPage(client, venueHtml, row.eventName);
        } catch (err) {
          console.warn(`[backfill-event-details] venue-site nav call failed for "${row.eventName}":`, err);
        }
        if (nav?.url && nav.linkText && coreSimilarity(nav.linkText, row.eventName) >= MATCH_THRESHOLD) {
          const resolvedUrl = safeResolveUrl(nav.url, row.venueOfficialUrl);
          if (resolvedUrl) {
            const showHtml = await fetchPage(resolvedUrl);
            await sleep(REQUEST_DELAY_MS);
            if (showHtml) {
              sourceHtml = showHtml;
              sourceLabel = "venue-site";
              venueSiteMatch++;
            }
          }
        }
      }
    }

    if (!sourceHtml) {
      const theatreInfoUrl = buildSearchUrl(THEATRE_INFO_SEARCH_URL, "sapi_fulltext", row.eventName);
      const html = await findShowPageViaSearch(client, theatreInfoUrl, row.eventName);
      if (html) {
        sourceHtml = html;
        sourceLabel = "theatre-info";
        theatreInfoMatch++;
      }
    }

    if (!sourceHtml) {
      const billetreducUrl = buildSearchUrl(BILLETREDUC_SEARCH_URL, "se", row.eventName);
      const html = await findShowPageViaSearch(client, billetreducUrl, row.eventName);
      if (html) {
        sourceHtml = html;
        sourceLabel = "billetreduc";
        billetreducMatch++;
      }
    }

    if (!sourceHtml) {
      noSourceFound++;
      console.log(`[SKIP] "${row.eventName}" — no usable source page found across venue-site/theatre.info/billetreduc`);
      continue;
    }

    let extracted: ExtractionResult | null = null;
    try {
      extracted = await extractEventDetails(client, sourceHtml, row.eventName, row.venueName);
    } catch (err) {
      console.warn(`[backfill-event-details] extraction call failed for "${row.eventName}":`, err);
    }
    if (!extracted) {
      console.log(`[SKIP] "${row.eventName}" — extraction returned nothing usable`);
      continue;
    }

    const posterImageUrl =
      extracted.posterImageUrl && containsLiteral(sourceHtml, extracted.posterImageUrl) ? extracted.posterImageUrl : null;
    const castMembers = extracted.castMembers.filter((name) => containsLiteral(sourceHtml!, name));

    if (extracted.author && !containsLiteral(sourceHtml, extracted.author)) {
      console.warn(`[backfill-event-details] "${row.eventName}" — author "${extracted.author}" not found verbatim on source page, keeping anyway (flag for spot-check)`);
    }
    if (extracted.director && !containsLiteral(sourceHtml, extracted.director)) {
      console.warn(`[backfill-event-details] "${row.eventName}" — director "${extracted.director}" not found verbatim on source page, keeping anyway (flag for spot-check)`);
    }

    const patch: { imageUrl?: string; imageSource?: string; author?: string; director?: string; durationMinutes?: number } = {};
    const filled: string[] = [];
    if (row.imageUrl === null && posterImageUrl) {
      patch.imageUrl = posterImageUrl;
      patch.imageSource = sourceLabel ?? undefined;
      filled.push("imageUrl");
      fieldFillCounts.imageUrl++;
    }
    if (row.author === null && extracted.author) {
      patch.author = extracted.author;
      filled.push("author");
      fieldFillCounts.author++;
    }
    if (row.director === null && extracted.director) {
      patch.director = extracted.director;
      filled.push("director");
      fieldFillCounts.director++;
    }
    if (row.durationMinutes === null && extracted.durationMinutes) {
      patch.durationMinutes = Math.round(extracted.durationMinutes);
      filled.push("durationMinutes");
      fieldFillCounts.durationMinutes++;
    }

    const namesToLink = [...castMembers];
    if (patch.author) namesToLink.push(patch.author);
    if (patch.director) namesToLink.push(patch.director);

    if (Object.keys(patch).length > 0 || namesToLink.length > 0) {
      console.log(
        `[${DRY_RUN ? "WOULD ENRICH" : "ENRICHED"}] "${row.eventName}" (${sourceLabel}) — fields: ${filled.join(", ") || "none"}, cast: ${namesToLink.join(", ") || "none"}`,
      );
      if (!DRY_RUN) {
        if (Object.keys(patch).length > 0) await db.update(events).set(patch).where(eq(events.id, row.eventId));
        if (namesToLink.length > 0) {
          const { created, linked } = await upsertAndLinkArtists(db, row.eventId, namesToLink);
          artistsCreated += created;
          artistsLinked += linked;
          fieldFillCounts.cast += linked;
        }
      }
      enriched++;
    } else {
      console.log(`[NO-OP] "${row.eventName}" (${sourceLabel}) — nothing new to extract`);
    }
  }

  console.log(
    `\n[backfill-event-details] done — ${enriched} enriched, ${venueSiteMatch} via venue-site, ${theatreInfoMatch} via theatre.info, ${billetreducMatch} via billetreduc, ${noSourceFound} no-source-found (of ${candidates.length} processed)`,
  );
  console.log(
    `[backfill-event-details] field fills — imageUrl: ${fieldFillCounts.imageUrl}, author: ${fieldFillCounts.author}, director: ${fieldFillCounts.director}, durationMinutes: ${fieldFillCounts.durationMinutes}, cast links: ${fieldFillCounts.cast} (artists created: ${artistsCreated})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-event-details] failed:", err);
    process.exit(1);
  });
