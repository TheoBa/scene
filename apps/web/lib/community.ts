import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, ilike, ne } from "drizzle-orm";
import { attendance, comments, events, follows, profiles, reactions } from "@scenes/db";
import { getDb } from "./db";
import { isReactionKind, type ReactionKind } from "./reactions";

export interface FeedItem {
  pseudo: string; // the reviewer (someone you follow)
  showSlug: string;
  showName: string;
  imageUrl: string | null;
  body: string;
  reaction: ReactionKind | null;
  updatedAt: Date;
  eventId: string;
  // Whether the viewer themself has attended / reviewed this same show —
  // powers the "you too?" nudge on the feed card.
  viewerHasAttended: boolean;
  viewerHasReviewed: boolean;
}

// Reviews from the people the user follows, most recent first. You can only
// follow someone who has a profile, so the pseudo join is always present.
export async function getFeed(userId: string): Promise<FeedItem[]> {
  const viewerAttendance = alias(attendance, "viewer_attendance");
  const viewerComments = alias(comments, "viewer_comments");

  const rows = await getDb()
    .select({
      pseudo: profiles.pseudo,
      eventId: events.id,
      showSlug: events.slug,
      showName: events.name,
      imageUrl: events.imageUrl,
      body: comments.body,
      reactionKind: reactions.kind,
      updatedAt: comments.updatedAt,
      viewerAttendedAt: viewerAttendance.seenAt,
      viewerCommentBody: viewerComments.body,
    })
    .from(follows)
    .innerJoin(comments, eq(comments.userId, follows.followeeId))
    .innerJoin(events, eq(events.id, comments.eventId))
    .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
    .leftJoin(
      reactions,
      and(
        eq(reactions.userId, follows.followeeId),
        eq(reactions.eventId, comments.eventId),
      ),
    )
    .leftJoin(
      viewerAttendance,
      and(
        eq(viewerAttendance.userId, userId),
        eq(viewerAttendance.eventId, comments.eventId),
      ),
    )
    .leftJoin(
      viewerComments,
      and(
        eq(viewerComments.userId, userId),
        eq(viewerComments.eventId, comments.eventId),
      ),
    )
    .where(eq(follows.followerId, userId))
    .orderBy(desc(comments.updatedAt))
    .limit(60);

  return rows.map((r) => ({
    pseudo: r.pseudo,
    eventId: r.eventId,
    showSlug: r.showSlug,
    showName: r.showName,
    imageUrl: r.imageUrl,
    body: r.body,
    reaction:
      r.reactionKind && isReactionKind(r.reactionKind) ? r.reactionKind : null,
    updatedAt: r.updatedAt,
    viewerHasAttended: r.viewerAttendedAt !== null,
    viewerHasReviewed: r.viewerCommentBody !== null,
  }));
}

export interface PersonResult {
  pseudo: string;
  isFollowing: boolean;
}

// People search by pseudo (substring), excluding the viewer. Marks who they
// already follow so the button renders correctly.
export async function searchPeople(
  query: string,
  viewerId: string,
): Promise<PersonResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await getDb()
    .select({ pseudo: profiles.pseudo, followerId: follows.followerId })
    .from(profiles)
    .leftJoin(
      follows,
      and(
        eq(follows.followeeId, profiles.userId),
        eq(follows.followerId, viewerId),
      ),
    )
    .where(and(ilike(profiles.pseudo, `%${q}%`), ne(profiles.userId, viewerId)))
    .orderBy(profiles.pseudo)
    .limit(8);

  return rows.map((r) => ({ pseudo: r.pseudo, isFollowing: r.followerId !== null }));
}

export interface ProfileReview {
  showSlug: string;
  showName: string;
  imageUrl: string | null;
  body: string;
  reaction: ReactionKind | null;
  updatedAt: Date;
}

export interface PublicProfile {
  userId: string;
  pseudo: string;
  bio: string | null;
  instagramHandle: string | null;
  websiteUrl: string | null;
  seenCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  reviews: ProfileReview[];
}

// A public profile by pseudo: their bio/socials, seen count and their
// reviews, plus the viewer's relationship (self / following). `viewerId` is
// undefined for logged-out visitors (invite links work for them too).
export async function getProfileByPseudo(
  pseudo: string,
  viewerId?: string,
): Promise<PublicProfile | null> {
  const db = getDb();

  const [profile] = await db
    .select({
      userId: profiles.userId,
      pseudo: profiles.pseudo,
      bio: profiles.bio,
      instagramHandle: profiles.instagramHandle,
      websiteUrl: profiles.websiteUrl,
    })
    .from(profiles)
    .where(eq(profiles.pseudo, pseudo))
    .limit(1);
  if (!profile) return null;

  const [{ seenCount }] = await db
    .select({ seenCount: count() })
    .from(attendance)
    .where(eq(attendance.userId, profile.userId));

  let isFollowing = false;
  if (viewerId && viewerId !== profile.userId) {
    const [row] = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerId),
          eq(follows.followeeId, profile.userId),
        ),
      )
      .limit(1);
    isFollowing = !!row;
  }

  const reviewRows = await db
    .select({
      showSlug: events.slug,
      showName: events.name,
      imageUrl: events.imageUrl,
      body: comments.body,
      reactionKind: reactions.kind,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .innerJoin(events, eq(events.id, comments.eventId))
    .leftJoin(
      reactions,
      and(
        eq(reactions.userId, profile.userId),
        eq(reactions.eventId, comments.eventId),
      ),
    )
    .where(eq(comments.userId, profile.userId))
    .orderBy(desc(comments.updatedAt));

  return {
    userId: profile.userId,
    pseudo: profile.pseudo,
    bio: profile.bio,
    instagramHandle: profile.instagramHandle,
    websiteUrl: profile.websiteUrl,
    seenCount,
    isFollowing,
    isSelf: viewerId === profile.userId,
    reviews: reviewRows.map((r) => ({
      showSlug: r.showSlug,
      showName: r.showName,
      imageUrl: r.imageUrl,
      body: r.body,
      reaction:
        r.reactionKind && isReactionKind(r.reactionKind) ? r.reactionKind : null,
      updatedAt: r.updatedAt,
    })),
  };
}

// The signed-in user's own pseudo (for building their invite link), or null if
// they haven't onboarded yet.
export async function getMyPseudo(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ pseudo: profiles.pseudo })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.pseudo ?? null;
}
