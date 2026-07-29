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

export type DevNoteStatus = "new" | "processed";

export function isDevNoteStatus(v: string): v is DevNoteStatus {
  return v === "new" || v === "processed";
}
