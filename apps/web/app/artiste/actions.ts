"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { artistFollows, artists } from "@scenes/db";
import type { FollowActionResult } from "@/components/FollowButton";
import type { ProfileFields, UpdateProfileResult } from "@/components/ClaimedEntityEditForm";

const MAX_BIO = 2000;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

async function resolveArtistId(slug: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: artists.id })
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

// Follow an artist (one-way, no self-follow guard — an artist isn't a user).
export async function followArtist(slug: string): Promise<FollowActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const artistId = await resolveArtistId(slug);
  if (!artistId) return { ok: false, error: "Artiste introuvable." };

  await getDb()
    .insert(artistFollows)
    .values({ userId: session.user.id, artistId })
    .onConflictDoNothing();

  revalidatePath(`/artiste/${slug}`);
  return { ok: true, following: true };
}

export async function unfollowArtist(slug: string): Promise<FollowActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const artistId = await resolveArtistId(slug);
  if (!artistId) return { ok: false, error: "Artiste introuvable." };

  await getDb()
    .delete(artistFollows)
    .where(and(eq(artistFollows.userId, session.user.id), eq(artistFollows.artistId, artistId)));

  revalidatePath(`/artiste/${slug}`);
  return { ok: true, following: false };
}

// Minimal self-edit for a claimed artist: bio/photo/official link only. Same
// ownership re-check as updateVenueProfile — the real security boundary.
export async function updateArtistProfile(
  slug: string,
  input: ProfileFields,
): Promise<UpdateProfileResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const [artist] = await getDb()
    .select({ id: artists.id, claimedByUserId: artists.claimedByUserId })
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);
  if (!artist) return { ok: false, error: "Artiste introuvable." };
  if (artist.claimedByUserId !== session.user.id) {
    return { ok: false, error: "Non autorisé." };
  }

  const bio = input.bio.trim().slice(0, MAX_BIO);
  const imageUrl = input.imageUrl.trim();
  const officialUrl = input.officialUrl.trim();
  if (imageUrl && !isHttpUrl(imageUrl)) {
    return { ok: false, error: "URL de photo invalide (http/https)." };
  }
  if (officialUrl && !isHttpUrl(officialUrl)) {
    return { ok: false, error: "Lien officiel invalide (http/https)." };
  }

  await getDb()
    .update(artists)
    .set({
      bio: bio || null,
      imageUrl: imageUrl || null,
      officialUrl: officialUrl || null,
    })
    .where(eq(artists.id, artist.id));

  revalidatePath(`/artiste/${slug}`);
  return { ok: true };
}
