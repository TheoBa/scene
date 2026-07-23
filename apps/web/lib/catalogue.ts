import { and, asc, eq, gte } from "drizzle-orm";
import { events, performances, venues } from "@scenes/db";
import { getDb } from "./db";

export interface ShowCard {
  slug: string;
  name: string;
  author: string | null;
  nextStartsAt: Date; // soonest upcoming performance
  nextVenue: string;
  upcomingCount: number;
}

export interface ShowDetail {
  name: string;
  slug: string;
  author: string | null;
  director: string | null;
  tags: string[];
  durationMinutes: number | null;
  officialUrl: string | null;
  performances: { startsAt: Date; venue: string; address: string | null }[];
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
      startsAt: performances.startsAt,
      venue: venues.name,
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
        nextStartsAt: r.startsAt,
        nextVenue: r.venue,
        upcomingCount: 1,
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
      officialUrl: events.officialUrl,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) return null;

  const perfs = await getDb()
    .select({
      startsAt: performances.startsAt,
      venue: venues.name,
      address: venues.address,
    })
    .from(performances)
    .innerJoin(venues, eq(performances.venueId, venues.id))
    .where(
      and(eq(performances.eventId, event.id), gte(performances.startsAt, new Date())),
    )
    .orderBy(asc(performances.startsAt));

  return {
    name: event.name,
    slug: event.slug,
    author: event.author,
    director: event.director,
    tags: event.tags,
    durationMinutes: event.durationMinutes,
    officialUrl: event.officialUrl,
    performances: perfs,
  };
}
