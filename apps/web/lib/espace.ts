import { and, desc, eq } from "drizzle-orm";
import { attendance, comments, events, reactions } from "@scenes/db";
import { getDb } from "./db";
import { isReactionKind, type ReactionKind } from "./reactions";

export interface SeenShow {
  slug: string;
  name: string;
  author: string | null;
  imageUrl: string | null;
  seenAt: Date;
  reaction: ReactionKind | null; // the user's emoji on this show, if any
  comment: string | null; // the user's review, if written
}

// Every show the user has marked as seen, most-recent first, joined with their
// own reaction and comment. Powers the Mon Espace tab.
export async function getUserSeenShows(userId: string): Promise<SeenShow[]> {
  const rows = await getDb()
    .select({
      slug: events.slug,
      name: events.name,
      author: events.author,
      imageUrl: events.imageUrl,
      seenAt: attendance.seenAt,
      reactionKind: reactions.kind,
      commentBody: comments.body,
    })
    .from(attendance)
    .innerJoin(events, eq(attendance.eventId, events.id))
    .leftJoin(
      reactions,
      and(
        eq(reactions.eventId, attendance.eventId),
        eq(reactions.userId, userId),
      ),
    )
    .leftJoin(
      comments,
      and(
        eq(comments.eventId, attendance.eventId),
        eq(comments.userId, userId),
      ),
    )
    .where(eq(attendance.userId, userId))
    .orderBy(desc(attendance.seenAt));

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    author: r.author,
    imageUrl: r.imageUrl,
    seenAt: r.seenAt,
    reaction:
      r.reactionKind && isReactionKind(r.reactionKind) ? r.reactionKind : null,
    comment: r.commentBody,
  }));
}

// Whether the user has marked a given event as seen.
export async function getUserSeen(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ userId: attendance.userId })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.userId, userId)))
    .limit(1);
  return !!row;
}
