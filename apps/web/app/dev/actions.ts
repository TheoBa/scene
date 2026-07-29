"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getDevAccess } from "@/lib/dev-access";
import { devNotes } from "@scenes/db";
import { isDevCategory, isDevNoteStatus } from "@/lib/dev-notes";

const MAX_BODY = 4000;

export type SubmitDevNoteResult =
  | { ok: true }
  | { ok: false; error: string };

// Drop a note from the dev-mode widget. Access is re-checked here — the widget
// only rendering for allowlisted users is a convenience, not the security.
export async function submitDevNote(input: {
  body: string;
  category: string;
  path: string;
}): Promise<SubmitDevNoteResult> {
  const dev = await getDevAccess();
  if (!dev) return { ok: false, error: "Accès refusé." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Note vide." };
  if (body.length > MAX_BODY) return { ok: false, error: "Note trop longue." };

  const category = isDevCategory(input.category) ? input.category : "idea";
  const path = input.path.slice(0, 500) || null;

  await getDb().insert(devNotes).values({
    body,
    category,
    path,
    userId: dev.id,
  });

  revalidatePath("/dev/notes");
  return { ok: true };
}

export type SetNoteStatusResult =
  | { ok: true; status: string }
  | { ok: false; error: string };

// Triage a note (new ↔ processed) from the /dev/notes view.
export async function setNoteStatus(
  id: string,
  status: string,
): Promise<SetNoteStatusResult> {
  const dev = await getDevAccess();
  if (!dev) return { ok: false, error: "Accès refusé." };
  if (!isDevNoteStatus(status)) return { ok: false, error: "Statut inconnu." };

  await getDb().update(devNotes).set({ status }).where(eq(devNotes.id, id));

  revalidatePath("/dev/notes");
  return { ok: true, status };
}

export type DeleteNoteResult =
  | { ok: true }
  | { ok: false; error: string };

// Discard a note outright (e.g. a duplicate or accidental drop).
export async function deleteDevNote(id: string): Promise<DeleteNoteResult> {
  const dev = await getDevAccess();
  if (!dev) return { ok: false, error: "Accès refusé." };

  await getDb().delete(devNotes).where(eq(devNotes.id, id));

  revalidatePath("/dev/notes");
  return { ok: true };
}
