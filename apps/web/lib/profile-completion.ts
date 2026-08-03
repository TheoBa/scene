// Pure completion-gauge calculator — no DB access here on purpose, so it stays
// trivially unit-testable. The DB-facing side (counting follows/attendance/
// comments, reading profiles.bio etc.) lives in profile-completion-query.ts.
//
// `pseudo` is deliberately excluded from the checklist: onboarding always sets
// it, so it's true for every user and carries no signal.

export type ChecklistItemId =
  | "bio"
  | "social"
  | "follow"
  | "seen"
  | "review";

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;
  done: boolean;
  href: string; // where to go to complete this item
}

export interface CompletionInput {
  bio: string | null;
  instagramHandle: string | null;
  websiteUrl: string | null;
  followingCount: number;
  seenCount: number;
  reviewCount: number;
}

export interface CompletionResult {
  percent: number; // 0-100, rounded
  items: ChecklistItem[];
  missing: ChecklistItem[]; // items not yet done, for the nudge list
}

const MIN_FOLLOWING = 3;
const MIN_SEEN = 1;
const MIN_REVIEWS = 1;

export function computeCompletion(input: CompletionInput): CompletionResult {
  const items: ChecklistItem[] = [
    {
      id: "bio",
      label: "Ajoute une bio à ton profil",
      done: !!input.bio && input.bio.trim().length > 0,
      href: "/mon-espace",
    },
    {
      id: "social",
      label: "Renseigne Instagram ou ton site",
      done: !!input.instagramHandle || !!input.websiteUrl,
      href: "/mon-espace",
    },
    {
      id: "follow",
      label: `Suis au moins ${MIN_FOLLOWING} personnes`,
      done: input.followingCount >= MIN_FOLLOWING,
      href: "/communaute",
    },
    {
      id: "seen",
      label: "Marque un spectacle comme vu",
      done: input.seenCount >= MIN_SEEN,
      href: "/shows",
    },
    {
      id: "review",
      label: "Écris ton premier avis",
      done: input.reviewCount >= MIN_REVIEWS,
      href: "/mon-espace",
    },
  ];

  const filled = items.filter((i) => i.done).length;
  const percent = Math.round((filled / items.length) * 100);

  return {
    percent,
    items,
    missing: items.filter((i) => !i.done),
  };
}
