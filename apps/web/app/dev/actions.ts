"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getDevAccess } from "@/lib/dev-access";
import { artists, claims, devNoteAttachments, devNotes, venues } from "@scenes/db";
import {
  DEV_ATTACHMENT_MAX_BYTES,
  DEV_ATTACHMENT_MAX_COUNT,
  isAllowedAttachmentMimeType,
  isDevCategory,
  isDevNoteStatus,
} from "@/lib/dev-notes";

const MAX_BODY = 4000;
// Base64 overhead is ~4/3 of the raw file size; leave headroom above the
// client-side per-file cap (DEV_ATTACHMENT_MAX_BYTES) rather than derive it
// exactly — this is just a backstop against a pathological upload.
const MAX_ATTACHMENT_DATA_URL = DEV_ATTACHMENT_MAX_BYTES * 2;

export type SubmitDevNoteResult =
  | { ok: true }
  | { ok: false; error: string };

// Drop a note from the dev-mode widget. Access is re-checked here — the widget
// only rendering for allowlisted users is a convenience, not the security.
export async function submitDevNote(input: {
  body: string;
  category: string;
  path: string;
  attachments?: { filename: string; mimeType: string; dataUrl: string }[];
}): Promise<SubmitDevNoteResult> {
  const dev = await getDevAccess();
  if (!dev) return { ok: false, error: "Accès refusé." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Note vide." };
  if (body.length > MAX_BODY) return { ok: false, error: "Note trop longue." };

  const category = isDevCategory(input.category) ? input.category : "idea";
  const path = input.path.slice(0, 500) || null;

  const attachments = (input.attachments ?? [])
    .filter(
      (a) =>
        isAllowedAttachmentMimeType(a.mimeType) &&
        a.dataUrl.startsWith("data:") &&
        a.dataUrl.length <= MAX_ATTACHMENT_DATA_URL,
    )
    .slice(0, DEV_ATTACHMENT_MAX_COUNT);

  const db = getDb();
  const [note] = await db
    .insert(devNotes)
    .values({ body, category, path, userId: dev.id })
    .returning({ id: devNotes.id });

  if (attachments.length > 0) {
    await db.insert(devNoteAttachments).values(
      attachments.map((a) => ({
        noteId: note.id,
        filename: a.filename.slice(0, 255),
        mimeType: a.mimeType,
        dataUrl: a.dataUrl,
      })),
    );
  }

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

  const db = getDb();
  await db.update(devNotes).set({ status }).where(eq(devNotes.id, id));

  // Once a note is closed out, its attached documents have served their
  // purpose (shown to whoever reviewed the fix) — drop them so the table
  // doesn't grow unbounded with resolved notes' base64 payloads.
  if (status === "done") {
    await db.delete(devNoteAttachments).where(eq(devNoteAttachments.noteId, id));
  }

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

export type DecideClaimResult = { ok: true } | { ok: false; error: string };

// Approve/reject a claim request from /dev/claims. Approving sets the
// target's claimedByUserId/claimedAt; rejecting only flips claims.status —
// manual review only, no roles/permissions system.
export async function decideClaim(
  id: string,
  decision: "approved" | "rejected",
): Promise<DecideClaimResult> {
  const dev = await getDevAccess();
  if (!dev) return { ok: false, error: "Accès refusé." };

  const [claim] = await getDb().select().from(claims).where(eq(claims.id, id)).limit(1);
  if (!claim) return { ok: false, error: "Demande introuvable." };
  if (claim.status !== "pending") return { ok: false, error: "Déjà traitée." };

  await getDb()
    .update(claims)
    .set({ status: decision, decidedAt: new Date(), decidedBy: dev.id })
    .where(eq(claims.id, id));

  if (decision === "approved") {
    const table = claim.targetType === "venue" ? venues : artists;
    await getDb()
      .update(table)
      .set({ claimedByUserId: claim.userId, claimedAt: new Date() })
      .where(eq(table.id, claim.targetId));
  }

  revalidatePath("/dev/claims");
  return { ok: true };
}
