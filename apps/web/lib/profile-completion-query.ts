import { count, eq } from "drizzle-orm";
import { attendance, comments, follows, profiles } from "@scenes/db";
import { getDb } from "./db";
import { computeCompletion, type CompletionResult } from "./profile-completion";

// Server-only read side of the completion gauge (touches the DB). Kept out of
// profile-completion.ts so the pure calculator stays trivially unit-testable.

// Gathers the signals computeCompletion() needs and runs it. Returns null if
// the user has no profile row yet (shouldn't happen post-onboarding, but the
// caller — /mon-espace — is guarded by the onboarding redirect regardless).
export async function getProfileCompletion(
  userId: string,
): Promise<CompletionResult | null> {
  const db = getDb();

  const [profile] = await db
    .select({
      bio: profiles.bio,
      instagramHandle: profiles.instagramHandle,
      websiteUrl: profiles.websiteUrl,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return null;

  const [[{ followingCount }], [{ seenCount }], [{ reviewCount }]] =
    await Promise.all([
      db.select({ followingCount: count() }).from(follows).where(eq(follows.followerId, userId)),
      db.select({ seenCount: count() }).from(attendance).where(eq(attendance.userId, userId)),
      db.select({ reviewCount: count() }).from(comments).where(eq(comments.userId, userId)),
    ]);

  return computeCompletion({
    bio: profile.bio,
    instagramHandle: profile.instagramHandle,
    websiteUrl: profile.websiteUrl,
    followingCount,
    seenCount,
    reviewCount,
  });
}
