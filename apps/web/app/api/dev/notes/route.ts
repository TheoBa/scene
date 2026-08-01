import { NextResponse } from "next/server";
import { checkDevNotesApiAuth } from "@/lib/dev-notes-api-auth";
import { getDevNotes } from "@/lib/dev-notes-query";

// Read side for the plan-from-notes skill — the whole backlog, every status.
// The skill filters client-side; keeping this route dumb (no query params)
// means it never needs updating when the skill's grouping logic changes.
export async function GET(request: Request) {
  if (!checkDevNotesApiAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await getDevNotes();
  return NextResponse.json({ notes });
}
