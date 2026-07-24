"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { follows, profiles } from "@scenes/db";
import { searchPeople, type PersonResult } from "@/lib/community";

export type FollowResult =
  | { ok: true; following: boolean }
  | { ok: false; error: string };

async function resolveFolloweeId(pseudo: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.pseudo, pseudo))
    .limit(1);
  return row?.userId ?? null;
}

// Follow the person with the given pseudo (one-way). Idempotent; guards against
// following yourself.
export async function follow(pseudo: string): Promise<FollowResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const followeeId = await resolveFolloweeId(pseudo);
  if (!followeeId) return { ok: false, error: "Profil introuvable." };
  if (followeeId === session.user.id) {
    return { ok: false, error: "Vous ne pouvez pas vous suivre vous-même." };
  }

  await getDb()
    .insert(follows)
    .values({ followerId: session.user.id, followeeId })
    .onConflictDoNothing();

  revalidatePath("/communaute");
  revalidatePath(`/u/${pseudo}`);
  return { ok: true, following: true };
}

export async function unfollow(pseudo: string): Promise<FollowResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const followeeId = await resolveFolloweeId(pseudo);
  if (!followeeId) return { ok: false, error: "Profil introuvable." };

  await getDb()
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, session.user.id),
        eq(follows.followeeId, followeeId),
      ),
    );

  revalidatePath("/communaute");
  revalidatePath(`/u/${pseudo}`);
  return { ok: true, following: false };
}

export type SearchResult =
  | { ok: true; people: PersonResult[] }
  | { ok: false; error: string };

export async function searchPeopleAction(query: string): Promise<SearchResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };
  const people = await searchPeople(query, session.user.id);
  return { ok: true, people };
}
