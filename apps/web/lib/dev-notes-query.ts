import { desc, eq, inArray } from "drizzle-orm";
import { devNoteAttachments, devNotes, user } from "@scenes/db";
import { getDb } from "./db";

// Server-only read side of dev notes (touches the DB). Kept out of dev-notes.ts
// so the client widget can import the vocabulary without pulling in `pg`.

export interface DevNoteAttachment {
  id: string;
  filename: string;
  mimeType: string;
  dataUrl: string; // base64 data URL, stored inline (no object storage)
}

export interface DevNote {
  id: string;
  body: string;
  category: string;
  path: string | null;
  status: string;
  createdAt: Date;
  authorName: string | null; // account name/email of the note's author, if kept
  attachments: DevNoteAttachment[];
}

// Every dropped note, newest first, joined with its author and any attached
// documents. Powers /dev/notes. Two queries rather than a join — this is a
// low-volume admin table, and a join would duplicate the (large) base64
// attachment payload once per note row.
export async function getDevNotes(): Promise<DevNote[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: devNotes.id,
      body: devNotes.body,
      category: devNotes.category,
      path: devNotes.path,
      status: devNotes.status,
      createdAt: devNotes.createdAt,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(devNotes)
    .leftJoin(user, eq(devNotes.userId, user.id))
    .orderBy(desc(devNotes.createdAt));

  const noteIds = rows.map((r) => r.id);
  const attachmentRows = noteIds.length
    ? await db
        .select({
          id: devNoteAttachments.id,
          noteId: devNoteAttachments.noteId,
          filename: devNoteAttachments.filename,
          mimeType: devNoteAttachments.mimeType,
          dataUrl: devNoteAttachments.dataUrl,
        })
        .from(devNoteAttachments)
        .where(inArray(devNoteAttachments.noteId, noteIds))
    : [];

  const attachmentsByNoteId = new Map<string, DevNoteAttachment[]>();
  for (const a of attachmentRows) {
    const list = attachmentsByNoteId.get(a.noteId) ?? [];
    list.push({ id: a.id, filename: a.filename, mimeType: a.mimeType, dataUrl: a.dataUrl });
    attachmentsByNoteId.set(a.noteId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    category: r.category,
    path: r.path,
    status: r.status,
    createdAt: r.createdAt,
    authorName: r.authorName ?? r.authorEmail ?? null,
    attachments: attachmentsByNoteId.get(r.id) ?? [],
  }));
}
