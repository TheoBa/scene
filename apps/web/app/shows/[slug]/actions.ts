"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { events, reactions } from "@scenes/db";
import { getEventReactions, type EventReactions } from "@/lib/catalogue";
import { isReactionKind, type ReactionKind } from "@/lib/reactions";

export type SetReactionResult =
  | ({ ok: true } & EventReactions)
  | { ok: false; error: string };

// Toggle the signed-in user's reaction on a show (one reaction per user per
// show). Same kind → removes it; a different kind → switches; none → adds.
// Returns the fresh counts + the user's current reaction for the client to sync.
export async function setReaction(
  slug: string,
  kind: ReactionKind,
): Promise<SetReactionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Connecte-toi pour réagir." };
  if (!isReactionKind(kind)) return { ok: false, error: "Réaction inconnue." };

  const db = getDb();
  const userId = session.user.id;

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (!event) return { ok: false, error: "Spectacle introuvable." };

  const where = and(
    eq(reactions.userId, userId),
    eq(reactions.eventId, event.id),
  );
  const [current] = await db
    .select({ kind: reactions.kind })
    .from(reactions)
    .where(where)
    .limit(1);

  if (!current) {
    await db.insert(reactions).values({ userId, eventId: event.id, kind });
  } else if (current.kind === kind) {
    await db.delete(reactions).where(where); // un-react
  } else {
    await db.update(reactions).set({ kind }).where(where); // switch
  }

  revalidatePath(`/shows/${slug}`);
  const fresh = await getEventReactions(event.id, userId);
  return { ok: true, ...fresh };
}
