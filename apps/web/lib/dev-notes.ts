import { desc, eq } from "drizzle-orm";
import { devNotes, user } from "@scenes/db";
import { getDb } from "./db";

// The dev-mode feedback widget's vocabulary. Kept here so the client widget,
// the submit action, and the /dev/notes triage view all agree on the set.

export const DEV_CATEGORIES = [
  { value: "bug", label: "Bug", emoji: "🐞" },
  { value: "idea", label: "Idée", emoji: "💡" },
  { value: "other", label: "Autre", emoji: "📝" },
] as const;

export type DevCategory = (typeof DEV_CATEGORIES)[number]["value"];

export function isDevCategory(v: string): v is DevCategory {
  return DEV_CATEGORIES.some((c) => c.value === v);
}

export type DevNoteStatus = "new" | "processed";

export function isDevNoteStatus(v: string): v is DevNoteStatus {
  return v === "new" || v === "processed";
}

export interface DevNote {
  id: string;
  body: string;
  category: string;
  path: string | null;
  status: string;
  createdAt: Date;
  authorName: string | null; // account name/email of the note's author, if kept
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
  }));
}
