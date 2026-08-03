import { and, arrayOverlaps, asc, count, desc, eq, notInArray } from "drizzle-orm";
import { artistFollows, artists, eventArtists, events, profiles } from "@scenes/db";
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
  instagramUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
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
      instagramUrl: artists.instagramUrl,
      facebookUrl: artists.facebookUrl,
      twitterUrl: artists.twitterUrl,
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

// "Artistes qui pourraient te plaire": artists linked to a show tagged with a
// genre the user favorited at onboarding, that the user doesn't already
// follow, ranked by how many upcoming shows they're linked to (a proxy for
// follower count until a real one exists). Simplest v1 heuristic per the
// plan — not collaborative filtering.
export async function getRecommendedArtists(userId: string, limit = 12): Promise<ArtistCard[]> {
  const db = getDb();

  const [profileRow, alreadyFollowed] = await Promise.all([
    db
      .select({ favoriteGenres: profiles.favoriteGenres })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),
    db
      .select({ artistId: artistFollows.artistId })
      .from(artistFollows)
      .where(eq(artistFollows.userId, userId)),
  ]);

  const genres = profileRow[0]?.favoriteGenres ?? [];
  if (genres.length === 0) return [];

  const followedIds = alreadyFollowed.map((r) => r.artistId);

  const rows = await db
    .select({
      slug: artists.slug,
      name: artists.name,
      imageUrl: artists.imageUrl,
      artistId: artists.id,
      showCount: count(eventArtists.eventId),
    })
    .from(artists)
    .innerJoin(eventArtists, eq(eventArtists.artistId, artists.id))
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .where(
      and(
        arrayOverlaps(events.tags, genres),
        followedIds.length > 0 ? notInArray(artists.id, followedIds) : undefined,
      ),
    )
    .groupBy(artists.id, artists.slug, artists.name, artists.imageUrl)
    .orderBy(desc(count(eventArtists.eventId)))
    .limit(limit);

  return rows.map((r) => ({ slug: r.slug, name: r.name, imageUrl: r.imageUrl }));
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
