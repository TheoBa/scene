import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { devNotes } from "@scenes/db";
import { getDb } from "@/lib/db";
import { checkDevNotesApiAuth } from "@/lib/dev-notes-api-auth";
import { isDevNoteStatus } from "@/lib/dev-notes";

// Write side for the plan-from-notes skill — flips one note's lifecycle
// status (see DEV_NOTE_STATUSES). Status-only: the skill never edits note
// bodies, only the vocabulary it owns.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkDevNotesApiAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (typeof status !== "string" || !isDevNoteStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [updated] = await getDb()
    .update(devNotes)
    .set({ status })
    .where(eq(devNotes.id, id))
    .returning({ id: devNotes.id });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
