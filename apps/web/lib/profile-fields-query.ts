import { eq } from "drizzle-orm";
import { profiles } from "@scenes/db";
import { getDb } from "./db";
import type { SelfProfileFields } from "@/components/ProfileEditForm";

// The signed-in user's own bio/Instagram/website, as initial values for
// ProfileEditForm on /mon-espace. Null fields become "" — the form always
// works with strings, the server action turns blanks back into null on save.
export async function getSelfProfileFields(
  userId: string,
): Promise<SelfProfileFields | null> {
  const [row] = await getDb()
    .select({
      bio: profiles.bio,
      instagramHandle: profiles.instagramHandle,
      websiteUrl: profiles.websiteUrl,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!row) return null;

  return {
    bio: row.bio ?? "",
    instagramHandle: row.instagramHandle ?? "",
    websiteUrl: row.websiteUrl ?? "",
  };
}
