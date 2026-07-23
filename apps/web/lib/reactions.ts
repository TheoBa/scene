// Canonical reaction set — single source of truth for the emoji, labels, and the
// `kind` values stored in the DB. Used by the UI (buttons), the server action
// (validation), and the seed. Add a reaction by appending here.
export const REACTIONS = [
  { kind: "like", emoji: "❤️", label: "J'aime" },
  { kind: "exceptional", emoji: "💐", label: "Exceptionnel" },
  { kind: "funny", emoji: "😂", label: "Drôle" },
  { kind: "emotional", emoji: "🥹", label: "Émouvant" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export const REACTION_KINDS: ReactionKind[] = REACTIONS.map((r) => r.kind);

export function isReactionKind(v: string): v is ReactionKind {
  return (REACTION_KINDS as string[]).includes(v);
}

// Zero-filled count map — a convenient starting shape for aggregation/UI.
export function emptyReactionCounts(): Record<ReactionKind, number> {
  return { like: 0, exceptional: 0, funny: 0, emotional: 0 };
}
