// Seed runner — resets the catalogue tables and inserts the manual data from
// ./data.ts. Idempotent: re-running gives the same result. Needs DATABASE_URL.
//   npm run db:seed            (from repo root)
import { createDb, events, venues } from "../src/index.js";
import { seedVenues } from "./data.js";

async function main(): Promise<void> {
  const db = createDb();
  let venueCount = 0;
  let eventCount = 0;

  await db.transaction(async (tx) => {
    // Clear catalogue — events first (FK to venues). Users are left untouched.
    await tx.delete(events);
    await tx.delete(venues);

    for (const v of seedVenues) {
      const [venue] = await tx
        .insert(venues)
        .values({ name: v.name, address: v.address })
        .returning({ id: venues.id });
      venueCount++;

      if (v.events.length > 0) {
        await tx.insert(events).values(
          v.events.map((e) => ({ venueId: venue.id, name: e.name, date: e.date })),
        );
        eventCount += v.events.length;
      }
    }
  });

  console.log(`[seed] done — ${venueCount} venues, ${eventCount} events`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
