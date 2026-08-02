// The dev-mode feedback widget's vocabulary. Pure constants/validators, no DB —
// safe to import from both the client widget and server code. The DB query lives
// in dev-notes-query.ts so this file stays browser-bundleable.

export const DEV_CATEGORIES = [
  { value: "bug", label: "Bug", emoji: "🐞" },
  { value: "idea", label: "Idée", emoji: "💡" },
  { value: "other", label: "Autre", emoji: "📝" },
] as const;

export type DevCategory = (typeof DEV_CATEGORIES)[number]["value"];

export function isDevCategory(v: string): v is DevCategory {
  return DEV_CATEGORIES.some((c) => c.value === v);
}

// Lifecycle a note moves through once the /plan-from-notes skill (and later,
// a build-from-plan skill) picks it up. `untackled` is the only status a note
// is ever created with; the rest are set by those skills via the /api/dev/notes
// route, except `done`, which is always a manual close-out by whoever reviews
// the merged PR (see NoteActions).
export const DEV_NOTE_STATUSES = [
  { value: "untackled", label: "À traiter" },
  { value: "waiting_for_input", label: "Infos requises" },
  { value: "plan_done", label: "Plan prêt" },
  { value: "implemented_pending_review", label: "À relire" },
  { value: "done", label: "Traité" },
] as const;

export type DevNoteStatus = (typeof DEV_NOTE_STATUSES)[number]["value"];

export function isDevNoteStatus(v: string): v is DevNoteStatus {
  return DEV_NOTE_STATUSES.some((s) => s.value === v);
}
