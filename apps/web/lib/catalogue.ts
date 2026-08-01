import { and, asc, count, eq, gte } from "drizzle-orm";
import { artists, eventArtists, events, performances, reactions, venues } from "@scenes/db";
import { getDb } from "./db";
import {
  emptyReactionCounts,
  isReactionKind,
  type ReactionKind,
} from "./reactions";

export interface ShowCard {
  slug: string;
  name: string;
  author: string | null;
  imageUrl: string | null;
  nextStartsAt: Date; // soonest upcoming performance
  nextVenue: string;
  upcomingCount: number;
  ticketUrl: string | null;
  ticketSource: string | null;
}

export interface ShowDetail {
  id: string;
  name: string;
  slug: string;
  author: string | null;
  director: string | null;
  tags: string[];
  durationMinutes: number | null;
  imageUrl: string | null;
  officialUrl: string | null;
  ticketUrl: string | null;
  ticketSource: string | null;
  // venueSlug is nullable: venues.slug is still nullable on the column until a
  // follow-up migration tightens it (see schema.ts) — a venue seen before that
  // backfill runs would render its name as plain text instead of a link.
  performances: { startsAt: Date; venue: string; venueSlug: string | null; address: string | null }[];
  artists: { slug: string; name: string }[];
}

// Discovery list: one card per show with an upcoming performance, soonest first.
// Rolls the individual performances up per event in JS — simpler than a window
// query and fine at POC scale.
export async function listUpcomingShows(): Promise<ShowCard[]> {
  const rows = await getDb()
    .select({
      slug: events.slug,
      name: events.name,
      author: events.author,
      imageUrl: events.imageUrl,
      startsAt: performances.startsAt,
      venue: venues.name,
      ticketUrl: events.ticketUrl,
      ticketSource: events.ticketSource,
    })
    .from(performances)
    .innerJoin(events, eq(performances.eventId, events.id))
    .innerJoin(venues, eq(performances.venueId, venues.id))
    .where(gte(performances.startsAt, new Date()))
    .orderBy(asc(performances.startsAt));

  const bySlug = new Map<string, ShowCard>();
  for (const r of rows) {
    const existing = bySlug.get(r.slug);
    if (existing) {
      existing.upcomingCount += 1;
    } else {
      // rows are date-ascending, so the first one seen is the soonest.
      bySlug.set(r.slug, {
        slug: r.slug,
        name: r.name,
        author: r.author,
        imageUrl: r.imageUrl,
        nextStartsAt: r.startsAt,
        nextVenue: r.venue,
        upcomingCount: 1,
        ticketUrl: r.ticketUrl,
        ticketSource: r.ticketSource,
      });
    }
  }

  return [...bySlug.values()].sort(
    (a, b) => a.nextStartsAt.getTime() - b.nextStartsAt.getTime(),
  );
}

// One show + its upcoming performances. null if the slug doesn't exist.
export async function getShowBySlug(slug: string): Promise<ShowDetail | null> {
  const [event] = await getDb()
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      author: events.author,
      director: events.director,
      tags: events.tags,
      durationMinutes: events.durationMinutes,
      imageUrl: events.imageUrl,
      officialUrl: events.officialUrl,
      ticketUrl: events.ticketUrl,
      ticketSource: events.ticketSource,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) return null;

  const perfs = await getDb()
    .select({
      startsAt: performances.startsAt,
      venue: venues.name,
      venueSlug: venues.slug,
      address: venues.address,
    })
    .from(performances)
    .innerJoin(venues, eq(performances.venueId, venues.id))
    .where(
      and(eq(performances.eventId, event.id), gte(performances.startsAt, new Date())),
    )
    .orderBy(asc(performances.startsAt));

  const linkedArtists = await getDb()
    .select({ slug: artists.slug, name: artists.name })
    .from(eventArtists)
    .innerJoin(artists, eq(eventArtists.artistId, artists.id))
    .where(eq(eventArtists.eventId, event.id))
    .orderBy(asc(artists.name));

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    author: event.author,
    director: event.director,
    tags: event.tags,
    durationMinutes: event.durationMinutes,
    imageUrl: event.imageUrl,
    officialUrl: event.officialUrl,
    ticketUrl: event.ticketUrl,
    ticketSource: event.ticketSource,
    performances: perfs,
    artists: linkedArtists,
  };
}

export interface EventReactions {
  counts: Record<ReactionKind, number>;
  total: number;
  mine: ReactionKind | null; // the signed-in user's reaction, if any
}

// Reaction counts for an event, plus the current user's own reaction. Unknown
// `kind` values (e.g. a reaction kind removed from the app later) are ignored.
export async function getEventReactions(
  eventId: string,
  userId?: string,
): Promise<EventReactions> {
  const db = getDb();

  const grouped = await db
    .select({ kind: reactions.kind, n: count() })
    .from(reactions)
    .where(eq(reactions.eventId, eventId))
    .groupBy(reactions.kind);

  const counts = emptyReactionCounts();
  let total = 0;
  for (const row of grouped) {
    total += row.n;
    if (isReactionKind(row.kind)) counts[row.kind] = row.n;
  }

  let mine: ReactionKind | null = null;
  if (userId) {
    const [row] = await db
      .select({ kind: reactions.kind })
      .from(reactions)
      .where(and(eq(reactions.eventId, eventId), eq(reactions.userId, userId)))
      .limit(1);
    if (row && isReactionKind(row.kind)) mine = row.kind;
  }

  return { counts, total, mine };
}
