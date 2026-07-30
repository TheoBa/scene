"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { claims } from "@scenes/db";

// Shared claim-submission logic for both venue and artist pages — manual
// review only in v1 (no email-domain auto-verification): this just files the
// request into the `claims` queue, triaged by hand at /dev/claims.

export type ClaimTargetType = "venue" | "artist";

const MAX_MESSAGE = 2000;

export type SubmitClaimResult = { ok: true } | { ok: false; error: string };

export async function submitClaim(
  targetType: ClaimTargetType,
  targetId: string,
  targetSlug: string,
  message: string,
): Promise<SubmitClaimResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const body = message.trim();
  if (!body) return { ok: false, error: "Message requis." };
  if (body.length > MAX_MESSAGE) return { ok: false, error: "Message trop long." };

  // Guard against duplicate pending requests from the same user on the same target.
  const [existing] = await getDb()
    .select({ id: claims.id })
    .from(claims)
    .where(
      and(
        eq(claims.targetType, targetType),
        eq(claims.targetId, targetId),
        eq(claims.userId, session.user.id),
        eq(claims.status, "pending"),
      ),
    )
    .limit(1);
  if (existing) return { ok: false, error: "Demande déjà en attente." };

  await getDb()
    .insert(claims)
    .values({ targetType, targetId, userId: session.user.id, message: body });

  revalidatePath(targetType === "venue" ? `/salle/${targetSlug}` : `/artiste/${targetSlug}`);
  return { ok: true };
}
