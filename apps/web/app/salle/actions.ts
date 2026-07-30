"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { venueFollows, venues } from "@scenes/db";
import type { FollowActionResult } from "@/components/FollowButton";

async function resolveVenueId(slug: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: venues.id })
    .from(venues)
    .where(eq(venues.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

// Follow a venue (one-way, no self-follow guard — a venue isn't a user).
export async function followVenue(slug: string): Promise<FollowActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const venueId = await resolveVenueId(slug);
  if (!venueId) return { ok: false, error: "Salle introuvable." };

  await getDb()
    .insert(venueFollows)
    .values({ userId: session.user.id, venueId })
    .onConflictDoNothing();

  revalidatePath(`/salle/${slug}`);
  return { ok: true, following: true };
}

export async function unfollowVenue(slug: string): Promise<FollowActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const venueId = await resolveVenueId(slug);
  if (!venueId) return { ok: false, error: "Salle introuvable." };

  await getDb()
    .delete(venueFollows)
    .where(and(eq(venueFollows.userId, session.user.id), eq(venueFollows.venueId, venueId)));

  revalidatePath(`/salle/${slug}`);
  return { ok: true, following: false };
}
