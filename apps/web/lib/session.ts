import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { profiles } from "@scenes/db";
import { auth } from "./auth";
import { getDb } from "./db";

export interface SessionUser {
  id: string;
  display: string; // pseudo if onboarded, else the account name/email
}

// The signed-in user's id + display handle, or null when logged out. Used by the
// header and home page to reflect auth state.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [p] = await getDb()
    .select({ pseudo: profiles.pseudo })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  return {
    id: session.user.id,
    display: p?.pseudo ?? session.user.name ?? session.user.email,
  };
}
