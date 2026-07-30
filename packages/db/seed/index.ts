// Seed runner — resets the catalogue and inserts the manual data from ./data.ts.
// Expands each show's weekly schedule (times per weekday over a run range, minus
// relâche) into concrete `performances`. Idempotent. Needs DATABASE_URL.
//   npm run db:seed            (from repo root)
import {
  artists,
  attendance,
  comments,
  createDb,
  eventArtists,
  events,
  performances,
  profiles,
  reactions,
  slugify,
  uniqueSlug,
  user,
  venues,
} from "../src/index.js";
import {
  seedShows,
  seedDemoUsers,
  seedDemoComments,
  type Weekday,
} from "./data.js";
import { inArray } from "drizzle-orm";

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
  let commentCount = 0;
  let artistCount = 0;

  await db.transaction(async (tx) => {
    // Non-destructive: upsert venues (by name) and events (by slug) so existing
    // event ids — and the real user reactions / attendance / comments that FK to
    // them — survive a reseed. Performances are derived from the schedule and
    // carry no user data, so they alone are cleared and rebuilt.
    await tx.delete(performances);

    // Distinct venues (already normalised in data.ts). Upsert by unique name —
    // slugs computed here (uniqueSlug guards collisions, same as resolve.ts's
    // worker-side venue upsert) so every seeded venue is reachable at
    // /salle/[slug] — then read them all back into a name → id map.
    const venueNames = [...new Set(seedShows.map((s) => s.venue))];
    const existingVenueSlugs = await tx.select({ slug: venues.slug }).from(venues);
    const takenVenueSlugs = new Set(existingVenueSlugs.flatMap((v) => (v.slug ? [v.slug] : [])));
    await tx
      .insert(venues)
      .values(
        venueNames.map((name) => {
          const slug = uniqueSlug(slugify(name), takenVenueSlugs);
          takenVenueSlugs.add(slug);
          return { name, slug };
        }),
      )
      .onConflictDoNothing();
    const venueRows = await tx
      .select({ id: venues.id, name: venues.name })
      .from(venues);
    const venueId = new Map(venueRows.map((v) => [v.name, v.id]));

    // Events keyed by slug — order follows seedShows for stable demo spread.
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
        .onConflictDoUpdate({
          target: events.slug,
          set: {
            name: show.title,
            author: show.author ?? null,
            director: show.director ?? null,
            tags: show.tags,
            durationMinutes: show.durationMinutes ?? null,
            imageUrl: POSTER_SLUGS.has(slug) ? `${slug}.jpg` : null,
            officialUrl: show.officialUrl ?? null,
          },
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
    const idBySlug = new Map(
      seedShows.map((s, i) => [slugify(s.title), eventIds[i]]),
    );

    // Backfill artists from the curated author/director fields — otherwise
    // /artiste pages stay empty until Ticketmaster-scale ingestion accumulates,
    // which defeats "artist pages exist by default". Each distinct string
    // becomes one artists row (no person/company split, no comma-splitting of
    // multi-name credits) — mirrors how `director` already conflates "metteur
    // en scène" and "compagnie" in one free-text column. Same
    // upsert-by-unique-name pattern as venues/resolve.ts, so a name that later
    // also appears via Ticketmaster's `performers[]` collapses onto this row.
    const artistNames = new Set<string>();
    for (const show of seedShows) {
      for (const raw of [show.author, show.director]) {
        const name = raw?.trim();
        if (name) artistNames.add(name);
      }
    }
    const existingArtists = await tx
      .select({ id: artists.id, name: artists.name, slug: artists.slug })
      .from(artists);
    const takenArtistSlugs = new Set(existingArtists.map((a) => a.slug));
    const artistIdByName = new Map(existingArtists.map((a) => [a.name, a.id]));
    const newArtistNames = [...artistNames].filter((name) => !artistIdByName.has(name));
    if (newArtistNames.length) {
      await tx
        .insert(artists)
        .values(
          newArtistNames.map((name) => {
            const slug = uniqueSlug(slugify(name), takenArtistSlugs);
            takenArtistSlugs.add(slug);
            return { name, slug };
          }),
        )
        .onConflictDoNothing();
      const inserted = await tx
        .select({ id: artists.id, name: artists.name })
        .from(artists)
        .where(inArray(artists.name, newArtistNames));
      for (const a of inserted) artistIdByName.set(a.name, a.id);
    }
    artistCount = newArtistNames.length;

    const eventArtistRows: { eventId: string; artistId: string }[] = [];
    seedShows.forEach((show, i) => {
      const eventId = eventIds[i];
      const names = new Set([show.author?.trim(), show.director?.trim()].filter(Boolean) as string[]);
      for (const name of names) {
        const artistId = artistIdByName.get(name);
        if (artistId) eventArtistRows.push({ eventId, artistId });
      }
    });
    if (eventArtistRows.length) {
      await tx.insert(eventArtists).values(eventArtistRows).onConflictDoNothing();
    }

    // Demo community — stable throwaway users with real profiles (findable by
    // pseudo, follow-able) plus reactions and reviews so the discovery counts and
    // the Ma communauté feed look alive. All inserts are additive
    // (onConflictDoNothing), so reseeds never duplicate and real signups are
    // untouched. Demo users have no `account` row, so they can't sign in.
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

    await tx
      .insert(profiles)
      .values(
        seedDemoUsers.map((u) => ({
          userId: u.id,
          pseudo: u.pseudo,
          frequency: "monthly",
          favoriteGenres: u.genres,
          onboardedAt: now,
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
      await tx.insert(reactions).values(reactionRows).onConflictDoNothing();
      reactionCount = reactionRows.length;
    }

    // Reviews (only for known slugs) — the feed content.
    const commentRows = seedDemoComments
      .map((c) => ({ userId: c.userId, eventId: idBySlug.get(c.slug), body: c.body }))
      .filter((c): c is { userId: string; eventId: string; body: string } =>
        Boolean(c.eventId),
      );
    if (commentRows.length) {
      await tx.insert(comments).values(commentRows).onConflictDoNothing();
      commentCount = commentRows.length;
    }

    // Attendance for every demo reaction or review, so demo profiles read as
    // having seen those shows (reacting/commenting implies seen).
    const seenPairs = new Map<string, { userId: string; eventId: string }>();
    for (const r of reactionRows) seenPairs.set(`${r.userId}|${r.eventId}`, r);
    for (const c of commentRows) seenPairs.set(`${c.userId}|${c.eventId}`, c);
    if (seenPairs.size) {
      await tx
        .insert(attendance)
        .values([...seenPairs.values()])
        .onConflictDoNothing();
    }
  });

  console.log(
    `[seed] done — ${new Set(seedShows.map((s) => s.venue)).size} venues, ` +
      `${seedShows.length} shows, ${artistCount} new artists, ` +
      `${perfCount} upcoming performances (${HORIZON_DAYS}d horizon), ` +
      `${reactionCount} demo reactions, ${commentCount} demo reviews`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
