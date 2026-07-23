// Seed runner — resets the catalogue and inserts the manual data from ./data.ts.
// Expands each show's weekly schedule (times per weekday over a run range, minus
// relâche) into concrete `performances`. Idempotent. Needs DATABASE_URL.
//   npm run db:seed            (from repo root)
import { createDb, events, performances, reactions, user, venues } from "../src/index.js";
import { seedShows, seedDemoUsers, type Weekday } from "./data.js";

// Kept in sync with apps/web/lib/reactions.ts (packages/db must not import from
// the web app). Used only to seed demo reaction counts.
const REACTION_KINDS = ["like", "exceptional", "funny", "emotional"] as const;

// Deterministic 0..1 pseudo-random from two integers — stable across reseeds.
function rand01(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Only materialise performances within this window from "now". Some runs last a
// year+ (La Cantatrice, La Leçon) — expanding them all would create thousands of
// far-future rows nobody will look at. The catalogue only shows what's upcoming.
const HORIZON_DAYS = 90;

// URL slug from a show name: strip accents, lowercase, non-alphanumerics → "-".
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slugs with a poster committed at apps/web/public/posters/<slug>.jpg. Stored as
// events.image_url = "<slug>.jpg"; shows not listed here keep image_url null.
// (Only "Mauvaise graine" — already finished — lacks a poster.)
const POSTER_SLUGS = new Set([
  "anne-baquet-chante-au-paradis",
  "l-embarras-du-choix",
  "la-cantatrice-chauve",
  "le-petit-chaperon-rouge",
  "les-petites-femmes-de-maupassant",
  "petites-miseres-de-la-vie-conjugale",
  "bel-ami",
  "juliette-victor-hugo-mon-fol-amour",
  "odyssee-la-conference-musicale",
  "le-cercle-des-poetes-disparus",
  "les-miserables",
  "crime-et-chatiment",
  "le-silence-des-voix-qui-se-sont-tues",
  "la-lecon",
  "oublie-moi",
  "les-justes",
  "dernier-coup-de-ciseaux",
  "sand-chopin",
  "dolores",
  "memoires-d-hadrien",
]);

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Weekday of a yyyy-mm-dd calendar date (UTC math avoids server-tz drift).
function weekdayOf(iso: string): Weekday {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// Next calendar day, as yyyy-mm-dd.
function addDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Calendar date (yyyy-mm-dd) of an instant, in Europe/Paris.
function parisCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The UTC instant for a wall-clock Europe/Paris time — DST-correct (finds the
// zone offset for that specific date rather than assuming +01:00/+02:00).
function parisWallClockToUtc(iso: string, hhmm: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const parisAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (parisAsUtc - guess));
}

async function main(): Promise<void> {
  const db = createDb();
  const now = new Date();
  const todayCal = parisCalendarDate(now);
  const horizonCal = parisCalendarDate(new Date(now.getTime() + HORIZON_DAYS * 86_400_000));

  let perfCount = 0;
  let reactionCount = 0;

  await db.transaction(async (tx) => {
    // Clear catalogue in FK order (performances → events/venues). Users untouched.
    await tx.delete(performances);
    await tx.delete(events);
    await tx.delete(venues);

    // Distinct venues (already normalised in data.ts) → name → id map.
    const venueNames = [...new Set(seedShows.map((s) => s.venue))];
    const venueId = new Map<string, string>();
    for (const name of venueNames) {
      const [row] = await tx.insert(venues).values({ name }).returning({ id: venues.id });
      venueId.set(name, row.id);
    }

    const eventIds: string[] = [];
    for (const show of seedShows) {
      const slug = slugify(show.title);
      const [event] = await tx
        .insert(events)
        .values({
          name: show.title,
          slug,
          author: show.author ?? null,
          director: show.director ?? null,
          tags: show.tags,
          durationMinutes: show.durationMinutes ?? null,
          imageUrl: POSTER_SLUGS.has(slug) ? `${slug}.jpg` : null,
          officialUrl: show.officialUrl ?? null,
        })
        .returning({ id: events.id });
      eventIds.push(event.id);

      const vid = venueId.get(show.venue);
      if (!vid) throw new Error(`unknown venue "${show.venue}" for "${show.title}"`);

      const rows: { eventId: string; venueId: string; startsAt: Date }[] = [];
      for (const run of show.runs) {
        const relache = new Set(run.relache ?? []);
        // Clamp iteration to [today, today+horizon] ∩ run range (ISO dates sort lexically).
        const from = run.start > todayCal ? run.start : todayCal;
        const to = run.end < horizonCal ? run.end : horizonCal;
        for (let d = from; d <= to; d = addDay(d)) {
          if (relache.has(d)) continue;
          const times = run.times[weekdayOf(d)];
          if (!times) continue;
          for (const t of times) {
            const startsAt = parisWallClockToUtc(d, t);
            if (startsAt >= now) rows.push({ eventId: event.id, venueId: vid, startsAt });
          }
        }
      }

      if (rows.length) {
        await tx.insert(performances).values(rows);
        perfCount += rows.length;
      }
    }

    // Demo reactions — stable throwaway users spread across shows so counts look
    // alive. onConflictDoNothing keeps reseeds from duplicating the users; old
    // reactions were cascade-deleted when the events were cleared above.
    await tx
      .insert(user)
      .values(
        seedDemoUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          emailVerified: true,
        })),
      )
      .onConflictDoNothing();

    const reactionRows: { userId: string; eventId: string; kind: string }[] = [];
    eventIds.forEach((eventId, ei) => {
      seedDemoUsers.forEach((u, ui) => {
        if (rand01(ui + 1, ei + 1) < 0.6) {
          const kind =
            REACTION_KINDS[Math.floor(rand01(ei + 1, ui + 7) * REACTION_KINDS.length)];
          reactionRows.push({ userId: u.id, eventId, kind });
        }
      });
    });
    if (reactionRows.length) {
      await tx.insert(reactions).values(reactionRows);
      reactionCount = reactionRows.length;
    }
  });

  console.log(
    `[seed] done — ${new Set(seedShows.map((s) => s.venue)).size} venues, ` +
      `${seedShows.length} shows, ${perfCount} upcoming performances (${HORIZON_DAYS}d horizon), ` +
      `${reactionCount} demo reactions`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
