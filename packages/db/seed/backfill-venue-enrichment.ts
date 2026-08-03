// One-off backfill: `venues.bio`/`imageUrl`/`officialUrl` are all nullable
// (see schema.ts) and already rendered on the venue page
// (apps/web/app/salle/[slug]/page.tsx) — nothing ingestion-side ever fills
// them, ingestion only ever supplies `name`/`address`. This script fills them
// in from Wikidata (+ Wikipedia for bio text). Re-run safely any time; it
// only touches venues still missing at least one field.
//   npm run backfill-venue-enrichment -w packages/db     (needs DATABASE_URL)
//
// Matching: same "skip rather than guess" philosophy as
// backfill-artist-enrichment.ts, adjusted for venues — generic names
// ("Théâtre National", "Opéra") collide across countries far more than
// artist names do, so this also requires a country match. See
// docs/plans/2026-08-03-venue-photo-bio-backfill.md for why.
import { createDb, venues } from "../src/index.js";
import { eq, or, isNull } from "drizzle-orm";

const WD_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_SUMMARY_API = "https://fr.wikipedia.org/api/rest_v1/page/summary/";
const USER_AGENT = "ScenesBot/1.0 (https://scenes.badoz.org; one-off venue enrichment backfill)";
const REQUEST_DELAY_MS = 200;
const BIO_MAX_LENGTH = 300;
const FRANCE_QID = "Q142";

// Instance-of (P31) values accepted as "this is a real venue/theatre
// institution", verified against real Paris venues (Théâtre du Châtelet,
// Comédie-Française, Odéon) before picking these. Anything else is rejected
// as a probable false positive (e.g. a commemorative plaque sharing the name).
const RELEVANT_QIDS = new Set([
  "Q24354", // theatre building
  "Q153562", // opera house
  "Q1060829", // concert hall
  "Q1329623", // cultural centre
  "Q742421", // theatre company / troupe (covers named institutions like the Comédie-Française)
  "Q2416217", // theatre troupe
]);

interface WdSearchResult {
  id: string;
}

interface WdSearchResponse {
  search: WdSearchResult[];
}

interface WdClaim {
  mainsnak?: { datavalue?: { value: unknown } };
}

interface WdEntity {
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, WdClaim[]>;
  sitelinks?: Record<string, { title: string }>;
}

interface WdEntitiesResponse {
  entities: Record<string, WdEntity>;
}

interface WikipediaSummary {
  extract?: string;
}

interface Enrichment {
  imageUrl: string | null;
  officialUrl: string | null;
  bio: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wdFetch<T>(params: Record<string, string>): Promise<T> {
  const url = `${WD_API}?${new URLSearchParams({ ...params, format: "json" })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikidata request failed (${res.status}): ${url}`);
  return (await res.json()) as T;
}

function claimStrings(entity: WdEntity, property: string): string[] {
  const claims = entity.claims?.[property] ?? [];
  return claims
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is string => typeof v === "string");
}

function claimQids(entity: WdEntity, property: string): string[] {
  const claims = entity.claims?.[property] ?? [];
  return claims
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter(
      (v): v is { id: string } =>
        typeof v === "object" && v !== null && "id" in (v as Record<string, unknown>),
    )
    .map((v) => v.id);
}

function isRelevant(entity: WdEntity): boolean {
  const instanceOf = claimQids(entity, "P31");
  if (!instanceOf.some((qid) => RELEVANT_QIDS.has(qid))) return false;

  // Reject a claimed country other than France; no claim at all is allowed
  // (small local venues often carry no P17), but a wrong country is exactly
  // the false-positive case generic venue names produce (e.g. a Swiss
  // "Théâtre de la Ville" matching the Paris one on name alone).
  const countries = claimQids(entity, "P17");
  return countries.length === 0 || countries.includes(FRANCE_QID);
}

async function findMatch(name: string): Promise<WdEntity | null> {
  const search = await wdFetch<WdSearchResponse>({
    action: "wbsearchentities",
    search: name,
    language: "fr",
    type: "item",
    limit: "10",
  });
  if (search.search.length === 0) return null;

  const ids = search.search.map((r) => r.id);
  const entities = await wdFetch<WdEntitiesResponse>({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "labels|descriptions|claims|sitelinks",
    languages: "fr|en",
  });

  const normalizedName = name.trim().toLowerCase();
  const candidates = Object.values(entities.entities).filter((entity) => {
    const labels = Object.values(entity.labels ?? {}).map((l) => l.value.toLowerCase());
    return labels.includes(normalizedName) && isRelevant(entity);
  });

  if (candidates.length !== 1) return null;
  return candidates[0];
}

// Cuts to the last full sentence within budget, or failing that the last
// full word, so a truncated bio never ends mid-word.
function truncateBio(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= BIO_MAX_LENGTH) return trimmed;

  const cut = trimmed.slice(0, BIO_MAX_LENGTH);
  const lastSentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastSentenceEnd > BIO_MAX_LENGTH * 0.5) {
    return cut.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

async function fetchBio(entity: WdEntity): Promise<string | null> {
  const frwikiTitle = entity.sitelinks?.frwiki?.title;
  if (frwikiTitle) {
    try {
      const res = await fetch(`${WIKIPEDIA_SUMMARY_API}${encodeURIComponent(frwikiTitle)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (res.ok) {
        const summary = (await res.json()) as WikipediaSummary;
        if (summary.extract) return truncateBio(summary.extract);
      }
    } catch {
      // fall through to the Wikidata description below
    }
  }

  const description = entity.descriptions?.fr?.value ?? entity.descriptions?.en?.value;
  return description ? truncateBio(description) : null;
}

function toEnrichment(entity: WdEntity, bio: string | null): Enrichment {
  const [imageFile] = claimStrings(entity, "P18");
  const [officialUrl] = claimStrings(entity, "P856");

  return {
    imageUrl: imageFile
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}`
      : null,
    officialUrl: officialUrl ?? null,
    bio,
  };
}

async function main(): Promise<void> {
  const db = createDb();

  const rows = await db
    .select({
      id: venues.id,
      name: venues.name,
      imageUrl: venues.imageUrl,
      officialUrl: venues.officialUrl,
      bio: venues.bio,
    })
    .from(venues)
    .where(or(isNull(venues.imageUrl), isNull(venues.officialUrl), isNull(venues.bio)));

  let enriched = 0;
  let noMatch = 0;
  let ambiguous = 0;

  for (const row of rows) {
    let entity: WdEntity | null;
    try {
      entity = await findMatch(row.name);
    } catch (err) {
      console.warn(`[backfill-venue-enrichment] lookup failed for "${row.name}":`, err);
      entity = null;
    }
    await sleep(REQUEST_DELAY_MS);

    if (!entity) {
      noMatch++;
      continue;
    }

    const bio = row.bio === null ? await fetchBio(entity) : null;
    await sleep(REQUEST_DELAY_MS);
    const found = toEnrichment(entity, bio);

    // Never overwrite a curated/already-set value — only fill what's null.
    const patch: Partial<Enrichment> = {};
    if (row.imageUrl === null && found.imageUrl) patch.imageUrl = found.imageUrl;
    if (row.officialUrl === null && found.officialUrl) patch.officialUrl = found.officialUrl;
    if (row.bio === null && found.bio) patch.bio = found.bio;

    if (Object.keys(patch).length === 0) {
      ambiguous++; // matched, but had nothing new to offer beyond what's set
      continue;
    }

    await db.update(venues).set(patch).where(eq(venues.id, row.id));
    console.log(`[backfill-venue-enrichment] enriched "${row.name}":`, Object.keys(patch));
    enriched++;
  }

  console.log(
    `[backfill-venue-enrichment] done — ${enriched} enriched, ${noMatch} unmatched, ${ambiguous} matched-but-empty (of ${rows.length} candidates)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-venue-enrichment] failed:", err);
    process.exit(1);
  });
