import { and, asc, eq } from "drizzle-orm";
import { artistFollows, artists, eventArtists, events } from "@scenes/db";
import { getDb } from "./db";

// Artist-page queries — mirrors venues.ts / catalogue.ts's shape.

export interface ArtistCard {
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface ArtistDetail {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  imageUrl: string | null;
  officialUrl: string | null;
  claimedByUserId: string | null;
  shows: { slug: string; name: string; imageUrl: string | null }[];
}

// Every artist, alphabetical — always-on (auto-created from ingestion/seed),
// so this isn't gated on being linked to a show.
export async function listArtists(): Promise<ArtistCard[]> {
  return getDb()
    .select({ slug: artists.slug, name: artists.name, imageUrl: artists.imageUrl })
    .from(artists)
    .orderBy(asc(artists.name));
}

// One artist + the shows they're linked to. null if the slug doesn't exist.
export async function getArtistBySlug(slug: string): Promise<ArtistDetail | null> {
  const db = getDb();

  const [artist] = await db
    .select({
      id: artists.id,
      name: artists.name,
      slug: artists.slug,
      bio: artists.bio,
      imageUrl: artists.imageUrl,
      officialUrl: artists.officialUrl,
      claimedByUserId: artists.claimedByUserId,
    })
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);
  if (!artist) return null;

  const shows = await db
    .select({ slug: events.slug, name: events.name, imageUrl: events.imageUrl })
    .from(eventArtists)
    .innerJoin(events, eq(eventArtists.eventId, events.id))
    .where(eq(eventArtists.artistId, artist.id))
    .orderBy(asc(events.name));

  return { ...artist, shows };
}

// Whether `viewerId` follows this artist. false for logged-out visitors.
export async function isFollowingArtist(artistId: string, viewerId?: string): Promise<boolean> {
  if (!viewerId) return false;
  const [row] = await getDb()
    .select({ userId: artistFollows.userId })
    .from(artistFollows)
    .where(and(eq(artistFollows.userId, viewerId), eq(artistFollows.artistId, artistId)))
    .limit(1);
  return !!row;
}
