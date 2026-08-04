// One-off enrichment: matches `curatedTheatres` (curated-theatres-data.ts,
// transcribed from Théo's curated Google Sheet) against existing `venues`
// rows by fuzzy name similarity, then:
//   - on a match: fills in address/lat/lng/officialUrl, but ONLY fields that
//     are currently null — never overwrites a value that's already set, same
//     convention as every other backfill-venue-*.ts script.
//   - on no match: inserts the curated theatre as a brand-new venue.
// Matching is deliberately "best guess, maximize coverage" rather than the
// stricter "skip rather than guess" used by backfill-venue-enrichment.ts —
// Théo's explicit call, since this list is hand-vetted and false negatives
// (inserting a duplicate venue) are just as costly as false positives here.
// That tradeoff means every decision is logged so mismatches can be spotted
// by skimming the run output, not just inferred from a summary count.
//   npm run backfill-venue-curated-list -w packages/db     (needs DATABASE_URL)
import { createDb, slugify, uniqueSlug, venues } from "../src/index.js";
import { eq } from "drizzle-orm";
import { curatedTheatres } from "./curated-theatres-data.js";

const MATCH_THRESHOLD = 0.55;

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .toLowerCase()
    .replace(/^(le |la |les |l'|l’)/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

interface ExistingVenue {
  id: string;
  name: string;
  normalizedName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  officialUrl: string | null;
}

function bestMatch(curatedName: string, candidates: ExistingVenue[]): { venue: ExistingVenue; score: number } | null {
  const normalizedCurated = normalizeName(curatedName);
  let best: { venue: ExistingVenue; score: number } | null = null;
  for (const candidate of candidates) {
    const score = similarity(normalizedCurated, candidate.normalizedName);
    if (!best || score > best.score) best = { venue: candidate, score };
  }
  return best;
}

async function main(): Promise<void> {
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
    normalizedName: normalizeName(r.name),
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
        await db.update(venues).set(patch).where(eq(venues.id, venue.id));
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
      // constraint) — skip adding to `existing` in that rare case rather than
      // pushing a bogus id that later updates would silently no-op against.
      if (row) {
        existing.push({
          id: row.id,
          name: theatre.name,
          normalizedName: normalizeName(theatre.name),
          address: theatre.address,
          lat: theatre.lat,
          lng: theatre.lng,
          officialUrl: theatre.website,
        });
      }
      inserted++;
      console.log(
        `[NEW] "${theatre.name}"${match ? ` (best candidate "${match.venue.name}" scored ${match.score.toFixed(2)}, below threshold)` : ""} inserted as /salle/${slug}`,
      );
    }
  }

  console.log(
    `[backfill-venue-curated-list] done — ${matchedFilled} matched+filled, ${matchedNoop} matched (already complete), ${inserted} inserted new, of ${curatedTheatres.length} total`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-venue-curated-list] failed:", err);
    process.exit(1);
  });
