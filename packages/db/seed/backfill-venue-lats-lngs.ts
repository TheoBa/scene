// One-off backfill: `venues.lat`/`venues.lng` were added nullable (see
// schema.ts's comment on the columns) — existing venues predate them, so this
// script fills them in from `venues.address` after the migration that adds
// the columns has been applied. Re-run safely any time; it only touches rows
// still missing lat/lng, e.g. after ingestion adds new venues.
//   npm run backfill-venue-lats-lngs -w packages/db     (needs DATABASE_URL)
//
// Geocoding: the Base Adresse Nationale (BAN) API — France's official address
// database, free, no API key, and no published rate cap (unlike Nominatim,
// which caps free use at 1 req/s). Good fit since all venues are in France.
import { createDb, venues } from "../src/index.js";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
const REQUEST_DELAY_MS = 150; // polite pacing even though BAN has no hard cap

interface BanFeature {
  geometry: { coordinates: [number, number] }; // [lng, lat]
}

interface BanResponse {
  features: BanFeature[];
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${BAN_SEARCH_URL}?q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[backfill-venue-lats-lngs] BAN request failed (${res.status}) for: ${address}`);
    return null;
  }
  const data = (await res.json()) as BanResponse;
  const [feature] = data.features;
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const db = createDb();

  const rows = await db
    .select({ id: venues.id, name: venues.name, address: venues.address })
    .from(venues)
    .where(and(isNotNull(venues.address), isNull(venues.lat)));

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const address = row.address as string; // guaranteed by isNotNull(venues.address) above
    const coords = await geocode(address);
    if (!coords) {
      console.warn(`[backfill-venue-lats-lngs] no match for "${row.name}" (${address})`);
      skipped++;
    } else {
      await db.update(venues).set(coords).where(eq(venues.id, row.id));
      updated++;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `[backfill-venue-lats-lngs] done — ${updated} venue(s) geocoded, ${skipped} unmatched`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-venue-lats-lngs] failed:", err);
    process.exit(1);
  });
