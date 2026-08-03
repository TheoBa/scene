import { desc, eq } from "drizzle-orm";
import { devNotes, user } from "@scenes/db";
import { getDb } from "./db";

// Server-only read side of dev notes (touches the DB). Kept out of dev-notes.ts
// so the client widget can import the vocabulary without pulling in `pg`.

export interface DevNote {
  id: string;
  body: string;
  category: string;
  path: string | null;
  status: string;
  createdAt: Date;
  authorName: string | null; // account name/email of the note's author, if kept
  screenshotDataUrl: string | null; // base64 PNG data URL, if one was attached
}

// Every dropped note, newest first, joined with its author. Powers /dev/notes.
export async function getDevNotes(): Promise<DevNote[]> {
  const rows = await getDb()
    .select({
      id: devNotes.id,
      body: devNotes.body,
      category: devNotes.category,
      path: devNotes.path,
      status: devNotes.status,
      createdAt: devNotes.createdAt,
      authorName: user.name,
      authorEmail: user.email,
      screenshotDataUrl: devNotes.screenshotDataUrl,
    })
    .from(devNotes)
    .leftJoin(user, eq(devNotes.userId, user.id))
    .orderBy(desc(devNotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    category: r.category,
    path: r.path,
    status: r.status,
    createdAt: r.createdAt,
    authorName: r.authorName ?? r.authorEmail ?? null,
    screenshotDataUrl: r.screenshotDataUrl,
  }));
}
