// One-off backfill: `venues.slug` was added nullable (venues already has rows in
// every environment, unlike `events`, which got its slug at table creation).
// Run this once per environment right after applying the migration that adds
// the column, and BEFORE applying the follow-up migration that tightens it to
// NOT NULL — see packages/db/src/schema.ts's comment on `venues.slug`.
//   npm run backfill-venue-slugs -w packages/db     (needs DATABASE_URL)
import { createDb, slugify, uniqueSlug, venues } from "../src/index.js";
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  const db = createDb();

  const rows = await db.select({ id: venues.id, name: venues.name, slug: venues.slug }).from(venues);
  const taken = new Set(rows.flatMap((r) => (r.slug ? [r.slug] : [])));

  let updated = 0;
  for (const row of rows) {
    if (row.slug) continue;
    const slug = uniqueSlug(slugify(row.name), taken);
    taken.add(slug);
    await db.update(venues).set({ slug }).where(eq(venues.id, row.id));
    updated++;
  }

  console.log(`[backfill-venue-slugs] done — ${updated} venue(s) slugged`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-venue-slugs] failed:", err);
    process.exit(1);
  });
