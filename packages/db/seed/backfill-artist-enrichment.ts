// One-off backfill: `artists.imageUrl`/`officialUrl`/`instagramUrl`/
// `facebookUrl`/`twitterUrl` are all nullable (see schema.ts) — `artists` rows
// are auto-created from performer names alone (apps/worker/src/enrich.ts), so
// none of these are ever populated by ingestion. This script fills them in
// from Wikidata. Re-run safely any time; it only touches artists still
// missing at least one field, e.g. after ingestion adds new artists, or after
// a previously-unmatched name gets a Wikidata entry.
//   npm run backfill-artist-enrichment -w packages/db     (needs DATABASE_URL)
//
// Matching: name search alone produces false positives (common names,
// unrelated Wikidata entries sharing a label), so a match is only accepted
// when (a) the candidate's label matches the artist name exactly
// (case-insensitive) and (b) its occupation/instance-of indicates a relevant
// type (actor, director, playwright, dancer, or a performing-arts group). If
// zero or more than one candidate survives both filters, the artist is
// skipped and logged rather than guessed at — see docs/plans/
// 2026-08-02-artist-photo-social-backfill.md for why.
import { createDb, artists } from "../src/index.js";
import { eq, or, isNull } from "drizzle-orm";

const WD_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "ScenesBot/1.0 (https://scenes.badoz.org; one-off artist enrichment backfill)";
const REQUEST_DELAY_MS = 200;

// Relevant occupations (P106) / instance-of (P31) values — theatre-adjacent
// people and groups. Anything else is rejected as a probable false positive.
const RELEVANT_QIDS = new Set([
  "Q33999", // actor
  "Q10800557", // film actor
  "Q2259451", // stage actor
  "Q3387717", // theatre director
  "Q2526255", // film director
  "Q3455803", // director
  "Q214917", // playwright
  "Q245068", // comedian
  "Q5716684", // choreographer
  "Q5716579", // dancer
  "Q215536", // dancer (alt)
  "Q32178211", // musical group
  "Q3152824", // theatre company / troupe
]);

interface WdSearchResult {
  id: string;
  label?: string;
}

interface WdSearchResponse {
  search: WdSearchResult[];
}

interface WdClaim {
  mainsnak?: { datavalue?: { value: unknown } };
}

interface WdEntity {
  labels?: Record<string, { value: string }>;
  claims?: Record<string, WdClaim[]>;
}

interface WdEntitiesResponse {
  entities: Record<string, WdEntity>;
}

interface Enrichment {
  imageUrl: string | null;
  officialUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
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
  const occupations = claimQids(entity, "P106"); // occupation
  const instanceOf = claimQids(entity, "P31"); // instance of
  return [...occupations, ...instanceOf].some((qid) => RELEVANT_QIDS.has(qid));
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
    props: "labels|claims",
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

function toEnrichment(entity: WdEntity): Enrichment {
  const [imageFile] = claimStrings(entity, "P18");
  const [facebookId] = claimStrings(entity, "P2013");
  const [instagramHandle] = claimStrings(entity, "P2003");
  const [twitterHandle] = claimStrings(entity, "P2002");
  const [officialUrl] = claimStrings(entity, "P856");

  return {
    imageUrl: imageFile
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}`
      : null,
    officialUrl: officialUrl ?? null,
    instagramUrl: instagramHandle ? `https://instagram.com/${instagramHandle}` : null,
    facebookUrl: facebookId ? `https://facebook.com/${facebookId}` : null,
    twitterUrl: twitterHandle ? `https://x.com/${twitterHandle}` : null,
  };
}

async function main(): Promise<void> {
  const db = createDb();

  const rows = await db
    .select({
      id: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
      officialUrl: artists.officialUrl,
      instagramUrl: artists.instagramUrl,
      facebookUrl: artists.facebookUrl,
      twitterUrl: artists.twitterUrl,
    })
    .from(artists)
    .where(
      or(
        isNull(artists.imageUrl),
        isNull(artists.officialUrl),
        isNull(artists.instagramUrl),
        isNull(artists.facebookUrl),
        isNull(artists.twitterUrl),
      ),
    );

  let enriched = 0;
  let noMatch = 0;
  let ambiguous = 0;

  for (const row of rows) {
    let entity: WdEntity | null;
    try {
      entity = await findMatch(row.name);
    } catch (err) {
      console.warn(`[backfill-artist-enrichment] lookup failed for "${row.name}":`, err);
      entity = null;
    }
    await sleep(REQUEST_DELAY_MS);

    if (!entity) {
      // findMatch() returns null both for "no candidate" and "more than one
      // survived the filters" — logged the same way since either means "don't
      // guess", the distinction only matters for a human reading the log.
      noMatch++;
      continue;
    }

    const found = toEnrichment(entity);
    // Never overwrite a curated/already-set value — only fill what's null.
    const patch: Partial<Enrichment> = {};
    if (row.imageUrl === null && found.imageUrl) patch.imageUrl = found.imageUrl;
    if (row.officialUrl === null && found.officialUrl) patch.officialUrl = found.officialUrl;
    if (row.instagramUrl === null && found.instagramUrl) patch.instagramUrl = found.instagramUrl;
    if (row.facebookUrl === null && found.facebookUrl) patch.facebookUrl = found.facebookUrl;
    if (row.twitterUrl === null && found.twitterUrl) patch.twitterUrl = found.twitterUrl;

    if (Object.keys(patch).length === 0) {
      ambiguous++; // matched, but had nothing new to offer beyond what's set
      continue;
    }

    await db.update(artists).set(patch).where(eq(artists.id, row.id));
    console.log(`[backfill-artist-enrichment] enriched "${row.name}":`, Object.keys(patch));
    enriched++;
  }

  console.log(
    `[backfill-artist-enrichment] done — ${enriched} enriched, ${noMatch} unmatched, ${ambiguous} matched-but-empty (of ${rows.length} candidates)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-artist-enrichment] failed:", err);
    process.exit(1);
  });
