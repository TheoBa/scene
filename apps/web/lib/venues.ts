import { and, asc, count, eq, gte, isNotNull } from "drizzle-orm";
import { events, performances, venueFollows, venues } from "@scenes/db";
import { getDb } from "./db";

// Venue-page queries — kept separate from catalogue.ts (event-centric) rather
// than growing it, mirroring its "card projection / full detail + joins" shape.

export interface VenueCard {
  slug: string;
  name: string;
  imageUrl: string | null;
  upcomingCount: number;
}

export interface VenueDetail {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  imageUrl: string | null;
  officialUrl: string | null;
  claimedByUserId: string | null;
  upcoming: { slug: string; name: string; startsAt: Date }[];
}

// Every venue, alphabetical — venues always-on (auto-created from
// ingestion/seed), so this isn't gated on having an upcoming show. `slug` is
// still nullable on the column (see schema.ts — backfilled post-deploy, then
// tightened to NOT NULL in a follow-up migration), so venues not yet slugged
// are filtered out here rather than linked to a broken page.
export async function listVenues(): Promise<VenueCard[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: venues.id,
      slug: venues.slug,
      name: venues.name,
      imageUrl: venues.imageUrl,
    })
    .from(venues)
    .where(isNotNull(venues.slug))
    .orderBy(asc(venues.name));

  const counts = await db
    .select({ venueId: performances.venueId, n: count() })
    .from(performances)
    .where(gte(performances.startsAt, new Date()))
    .groupBy(performances.venueId);
  const countByVenue = new Map(counts.map((c) => [c.venueId, c.n]));

  return rows.map((r) => ({
    slug: r.slug as string, // guaranteed by the isNotNull filter above
    name: r.name,
    imageUrl: r.imageUrl,
    upcomingCount: countByVenue.get(r.id) ?? 0,
  }));
}

// One venue + its upcoming programme. null if the slug doesn't exist.
export async function getVenueBySlug(slug: string): Promise<VenueDetail | null> {
  const db = getDb();

  const [venue] = await db
    .select({
      id: venues.id,
      name: venues.name,
      slug: venues.slug,
      address: venues.address,
      lat: venues.lat,
      lng: venues.lng,
      bio: venues.bio,
      imageUrl: venues.imageUrl,
      officialUrl: venues.officialUrl,
      claimedByUserId: venues.claimedByUserId,
    })
    .from(venues)
    .where(eq(venues.slug, slug))
    .limit(1);
  if (!venue) return null;

  const upcoming = await db
    .select({
      slug: events.slug,
      name: events.name,
      startsAt: performances.startsAt,
    })
    .from(performances)
    .innerJoin(events, eq(performances.eventId, events.id))
    .where(and(eq(performances.venueId, venue.id), gte(performances.startsAt, new Date())))
    .orderBy(asc(performances.startsAt));

  // `venue.slug` matched the (non-null) `slug` argument via eq() above, so it's
  // guaranteed non-null here even though the column itself is still nullable.
  return { ...venue, slug: venue.slug as string, upcoming };
}

// Whether `viewerId` follows this venue. false for logged-out visitors.
export async function isFollowingVenue(venueId: string, viewerId?: string): Promise<boolean> {
  if (!viewerId) return false;
  const [row] = await getDb()
    .select({ userId: venueFollows.userId })
    .from(venueFollows)
    .where(and(eq(venueFollows.userId, viewerId), eq(venueFollows.venueId, venueId)))
    .limit(1);
  return !!row;
}
