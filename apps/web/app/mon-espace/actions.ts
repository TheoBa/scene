"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendance, comments, events } from "@scenes/db";

const MAX_COMMENT = 2000;

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
