"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { profiles, referenceLikes } from "@scenes/db";
import { getDb } from "@/lib/db";

export interface OnboardingInput {
  pseudo: string;
  genres: string[];
  frequency: string | null;
  likedShows: string[]; // reference-piece ids from lib/reference-pieces.ts
}

export type OnboardingResult =
  | { ok: true }
  | { ok: false; error: string };

// Persists onboarding answers for the signed-in user, then marks them onboarded.
// Called from the wizard's final step. Idempotent — re-running upserts.
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Session expirée, reconnecte-toi." };

  const pseudo = input.pseudo.trim();
  if (pseudo.length < 2) return { ok: false, error: "Pseudo trop court." };

  const db = getDb();
  const userId = session.user.id;

  try {
    await db
      .insert(profiles)
      .values({
        userId,
        pseudo,
        frequency: input.frequency,
        favoriteGenres: input.genres,
        onboardedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: {
          pseudo,
          frequency: input.frequency,
          favoriteGenres: input.genres,
          onboardedAt: new Date(),
        },
      });
  } catch (err) {
    // Most likely the unique pseudo is taken (or a race on it).
    if (err instanceof Error && err.message.includes("profiles_pseudo_unique")) {
      return { ok: false, error: "Ce pseudo est déjà pris." };
    }
    throw err;
  }

  if (input.likedShows.length) {
    await db
      .insert(referenceLikes)
      .values(
        input.likedShows.map((referencePieceId) => ({ userId, referencePieceId })),
      )
      .onConflictDoNothing();
  }

  return { ok: true };
}
