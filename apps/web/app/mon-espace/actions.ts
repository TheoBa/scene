"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendance, comments, events, profiles } from "@scenes/db";
import type { SelfProfileFields, UpdateSelfProfileResult } from "@/components/ProfileEditForm";

const MAX_COMMENT = 2000;
const MAX_BIO = 2000;
const MAX_INSTAGRAM_HANDLE = 60;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

// Strips a leading "@" or a full instagram.com URL down to the bare handle, so
// users can paste either "@pseudo", "pseudo" or "https://instagram.com/pseudo"
// and get the same stored value.
function normalizeInstagramHandle(value: string): string {
  const trimmed = value.trim().replace(/^@/, "");
  const match = trimmed.match(/instagram\.com\/([^/?#]+)/i);
  return (match ? match[1] : trimmed).slice(0, MAX_INSTAGRAM_HANDLE);
}

export type CommentResult =
  | { ok: true; comment: string | null }
  | { ok: false; error: string };

// Create or update the signed-in user's comment on a show. Writing one also
// marks the show as seen. An empty body deletes the comment.
export async function saveComment(
  slug: string,
  body: string,
): Promise<CommentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const trimmed = body.trim().slice(0, MAX_COMMENT);
  const db = getDb();
  const userId = session.user.id;

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) return { ok: false, error: "Spectacle introuvable." };

  if (!trimmed) return deleteFor(userId, event.id, slug);

  await db
    .insert(comments)
    .values({ userId, eventId: event.id, body: trimmed })
    .onConflictDoUpdate({
      target: [comments.userId, comments.eventId],
      set: { body: trimmed, updatedAt: new Date() },
    });

  // Commenting implies attendance.
  await db
    .insert(attendance)
    .values({ userId, eventId: event.id })
    .onConflictDoNothing();

  revalidatePath("/mon-espace");
  revalidatePath(`/shows/${slug}`);
  return { ok: true, comment: trimmed };
}

export async function deleteComment(slug: string): Promise<CommentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const db = getDb();
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) return { ok: false, error: "Spectacle introuvable." };

  return deleteFor(session.user.id, event.id, slug);
}

async function deleteFor(
  userId: string,
  eventId: string,
  slug: string,
): Promise<CommentResult> {
  await getDb()
    .delete(comments)
    .where(and(eq(comments.userId, userId), eq(comments.eventId, eventId)));
  revalidatePath("/mon-espace");
  revalidatePath(`/shows/${slug}`);
  return { ok: true, comment: null };
}

// Self-edit for bio/Instagram handle/website — the fields the completion
// gauge nudges towards. Also shown on the public profile (/u/[pseudo]), so
// this revalidates that page too.
export async function updateSelfProfile(
  input: SelfProfileFields,
): Promise<UpdateSelfProfileResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };

  const bio = input.bio.trim().slice(0, MAX_BIO);
  const instagramHandle = normalizeInstagramHandle(input.instagramHandle);
  const websiteUrl = input.websiteUrl.trim();
  if (websiteUrl && !isHttpUrl(websiteUrl)) {
    return { ok: false, error: "Site web invalide (http/https)." };
  }

  const db = getDb();
  await db
    .update(profiles)
    .set({
      bio: bio || null,
      instagramHandle: instagramHandle || null,
      websiteUrl: websiteUrl || null,
    })
    .where(eq(profiles.userId, session.user.id));

  const [profile] = await db
    .select({ pseudo: profiles.pseudo })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  revalidatePath("/mon-espace");
  if (profile) revalidatePath(`/u/${profile.pseudo}`);
  return { ok: true };
}
