// Seed runner — resets the catalogue tables and inserts the manual data from
// ./data.ts. Idempotent: re-running gives the same result. Needs DATABASE_URL.
//   npm run db:seed            (from repo root)
import { createDb, events, performances, venues } from "../src/index.js";
import { seedEvents, seedVenues } from "./data.js";

async function main(): Promise<void> {
  const db = createDb();
  let eventCount = 0;
  let perfCount = 0;

  await db.transaction(async (tx) => {
    // Clear catalogue in FK order (performances → events/venues). Users untouched.
    await tx.delete(performances);
    await tx.delete(events);
    await tx.delete(venues);

    // Venues first — keep a name → id map to resolve performance references.
    const venueId = new Map<string, string>();
    for (const v of seedVenues) {
      const [row] = await tx
        .insert(venues)
        .values({ name: v.name, address: v.address })
        .returning({ id: venues.id });
      venueId.set(v.name, row.id);
    }

    for (const e of seedEvents) {
      const [event] = await tx
        .insert(events)
        .values({ name: e.name })
        .returning({ id: events.id });
      eventCount++;

      for (const p of e.performances) {
        const vid = venueId.get(p.venue);
        if (!vid) {
          throw new Error(`unknown venue "${p.venue}" for event "${e.name}"`);
        }
        await tx.insert(performances).values({
          eventId: event.id,
          venueId: vid,
          startsAt: new Date(p.startsAt),
        });
        perfCount++;
      }
    }
  });

  console.log(
    `[seed] done — ${seedVenues.length} venues, ${eventCount} events, ${perfCount} performances`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
