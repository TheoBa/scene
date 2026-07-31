"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { venueFollows, venues } from "@scenes/db";
import type { FollowActionResult } from "@/components/FollowButton";
import type { ProfileFields, UpdateProfileResult } from "@/components/ClaimedEntityEditForm";

const MAX_BIO = 2000;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

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

// Minimal self-edit for a claimed venue: bio/photo/official link only — no
// programme/show management in this iteration. Ownership is re-checked here
// server-side; the edit form's absence on other viewers' page renders is a
// UI convenience, not the security boundary.
export async function updateVenueProfile(
  slug: string,
  input: ProfileFields,
): Promise<UpdateProfileResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const [venue] = await getDb()
    .select({ id: venues.id, claimedByUserId: venues.claimedByUserId })
    .from(venues)
    .where(eq(venues.slug, slug))
    .limit(1);
  if (!venue) return { ok: false, error: "Salle introuvable." };
  if (venue.claimedByUserId !== session.user.id) {
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
    .update(venues)
    .set({
      bio: bio || null,
      imageUrl: imageUrl || null,
      officialUrl: officialUrl || null,
    })
    .where(eq(venues.id, venue.id));

  revalidatePath(`/salle/${slug}`);
  return { ok: true };
}
