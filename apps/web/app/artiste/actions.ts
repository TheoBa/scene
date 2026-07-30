"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { artistFollows, artists } from "@scenes/db";
import type { FollowActionResult } from "@/components/FollowButton";

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
