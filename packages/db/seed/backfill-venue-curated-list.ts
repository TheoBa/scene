// One-off enrichment: matches `curatedTheatres` (curated-theatres-data.ts,
// transcribed from Théo's curated Google Sheet) against existing `venues`
// rows by fuzzy name similarity, then:
//   - on a match: fills in address/lat/lng/officialUrl, but ONLY fields that
//     are currently null — never overwrites a value that's already set, same
//     convention as every other backfill-venue-*.ts script.
//   - on no match: inserts the curated theatre as a brand-new venue.
//
// Matching compares CORE tokens only (name with generic words like "théâtre",
// "centre", "de/du/la/le/les" stripped out first). A first version compared
// full normalized names directly and it was too permissive: short generic
// names like "Théâtre de Poissy" and "Théâtre de Paris" share enough
// characters ("theatre de") to score deceptively high on raw Levenshtein
// similarity even though they're unrelated venues in different départements —
// confirmed on a real staging run, where 35 of 67 matched venues were hit by
// 2+ different curated entries and ended up with wrong lat/lng/officialUrl
// (see PR #64 discussion). Stripping the generic words first means the score
// reflects only the actually-distinctive part of the name.
//   npm run backfill-venue-curated-list -w packages/db     (needs DATABASE_URL)
//   npm run backfill-venue-curated-list -w packages/db -- --dry-run   (no writes, just the log)
import { createDb, slugify, uniqueSlug, venues } from "../src/index.js";
import { eq } from "drizzle-orm";
import { curatedTheatres } from "./curated-theatres-data.js";

const MATCH_THRESHOLD = 0.75;
const DRY_RUN = process.argv.includes("--dry-run");

// Words too generic to help distinguish one theatre from another — stripped
// before scoring so the comparison rests on the actually distinctive part of
// the name (e.g. "dejazet" vs "paris", not "theatre de dejazet" vs "theatre de paris").
const STOPWORDS = new Set([
  "theatre",
  "centre",
  "espace",
  "salle",
  "scene",
  "municipal",
  "municipale",
  "national",
  "nationale",
  "dramatique",
  "culturel",
  "conventionnee",
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
]);

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// The distinctive core of a name: normalized, generic words dropped. Two
// names with an empty core (e.g. a name that's ONLY generic words) can never
// be trusted to match anything — there's nothing left to compare.
function coreTokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

// Levenshtein edit distance, then converted to a 0..1 similarity ratio
// (1 = identical). Small enough to inline rather than pull in a dependency.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
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
  if (coreA.length === 0 || coreB.length === 0) return 0; // nothing distinctive to compare
  return similarity(coreA, coreB);
}

interface ExistingVenue {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  officialUrl: string | null;
}

function bestMatch(curatedName: string, candidates: ExistingVenue[]): { venue: ExistingVenue; score: number } | null {
  let best: { venue: ExistingVenue; score: number } | null = null;
  for (const candidate of candidates) {
    const score = coreSimilarity(curatedName, candidate.name);
    if (!best || score > best.score) best = { venue: candidate, score };
  }
  return best;
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log("[backfill-venue-curated-list] DRY RUN — no writes will be made\n");

  const db = createDb();

  const rows = await db
    .select({
      id: venues.id,
      name: venues.name,
      slug: venues.slug,
      address: venues.address,
      lat: venues.lat,
      lng: venues.lng,
      officialUrl: venues.officialUrl,
    })
    .from(venues);

  const existing: ExistingVenue[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    officialUrl: r.officialUrl,
  }));
  const takenSlugs = new Set(rows.flatMap((r) => (r.slug ? [r.slug] : [])));

  let matchedFilled = 0;
  let matchedNoop = 0;
  let inserted = 0;

  for (const theatre of curatedTheatres) {
    const match = bestMatch(theatre.name, existing);

    if (match && match.score >= MATCH_THRESHOLD) {
      const { venue, score } = match;
      const patch: Partial<{ address: string; lat: number; lng: number; officialUrl: string }> = {};
      const filled: string[] = [];

      if (venue.address === null) {
        patch.address = theatre.address;
        filled.push("address");
      }
      if (venue.lat === null && venue.lng === null) {
        patch.lat = theatre.lat;
        patch.lng = theatre.lng;
        filled.push("lat,lng");
      }
      if (venue.officialUrl === null && theatre.website) {
        patch.officialUrl = theatre.website;
        filled.push("officialUrl");
      }

      if (filled.length > 0) {
        if (!DRY_RUN) await db.update(venues).set(patch).where(eq(venues.id, venue.id));
        // Keep the in-memory copy in sync so a LATER curated entry that also
        // matches this same venue sees the fields as already filled, instead
        // of re-deriving "is this null?" from a now-stale snapshot and
        // overwriting what this iteration just wrote.
        Object.assign(venue, patch);
        matchedFilled++;
        console.log(
          `[MATCH score=${score.toFixed(2)}] "${theatre.name}" -> existing "${venue.name}" (${venue.id}) filled: ${filled.join(", ")}`,
        );
      } else {
        matchedNoop++;
        console.log(
          `[MATCH score=${score.toFixed(2)}] "${theatre.name}" -> existing "${venue.name}" (${venue.id}) already complete, no-op`,
        );
      }
    } else {
      const slug = uniqueSlug(slugify(theatre.name), takenSlugs);
      takenSlugs.add(slug);
      const newVenue: ExistingVenue = {
        id: DRY_RUN ? `dry-run-${slug}` : "",
        name: theatre.name,
        address: theatre.address,
        lat: theatre.lat,
        lng: theatre.lng,
        officialUrl: theatre.website,
      };
      if (!DRY_RUN) {
        const [row] = await db
          .insert(venues)
          .values({
            name: theatre.name,
            slug,
            address: theatre.address,
            lat: theatre.lat,
            lng: theatre.lng,
            officialUrl: theatre.website,
          })
          .onConflictDoNothing()
          .returning({ id: venues.id });
        // onConflictDoNothing() returns nothing on a name collision (unique
        // constraint) — skip adding to `existing` in that rare case rather
        // than pushing a bogus id that a later update would silently no-op
        // against.
        if (!row) {
          console.log(`[NEW] "${theatre.name}" insert skipped — name collision with an existing venue`);
          continue;
        }
        newVenue.id = row.id;
      }
      existing.push(newVenue);
      inserted++;
      console.log(
        `[NEW] "${theatre.name}"${match ? ` (best candidate "${match.venue.name}" scored ${match.score.toFixed(2)}, below threshold)` : ""} ${DRY_RUN ? "would insert" : "inserted"} as /salle/${slug}`,
      );
    }
  }

  console.log(
    `\n[backfill-venue-curated-list] done — ${matchedFilled} matched+filled, ${matchedNoop} matched (already complete), ${inserted} inserted new, of ${curatedTheatres.length} total`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-venue-curated-list] failed:", err);
    process.exit(1);
  });
