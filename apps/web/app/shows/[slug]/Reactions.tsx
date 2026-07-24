"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { REACTIONS, type ReactionKind } from "@/lib/reactions";
import { setReaction } from "./actions";

// The emoji the user can pick from — one reaction per user per show. Counts live
// in the ReactionHistogram beside the dates, so this is just the picker.
export function Reactions({
  slug,
  mine: initialMine,
  signedIn,
  onReaction,
}: {
  slug: string;
  mine: ReactionKind | null;
  signedIn: boolean;
  // Called with the user's reaction after each toggle (null once un-reacted),
  // so a parent can reflect that reacting marks the show seen.
  onReaction?: (mine: ReactionKind | null) => void;
}) {
  const router = useRouter();
  const [mine, setMine] = useState(initialMine);
  const [pending, startTransition] = useTransition();

  function react(kind: ReactionKind) {
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    const prevMine = mine;
    // Optimistic: same kind un-reacts, any other kind switches/selects.
    const optimisticMine = mine === kind ? null : kind;
    setMine(optimisticMine);
    onReaction?.(optimisticMine);

    startTransition(async () => {
      const res = await setReaction(slug, kind);
      if (res.ok) {
        setMine(res.mine);
        onReaction?.(res.mine);
      } else {
        setMine(prevMine);
        onReaction?.(prevMine);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {REACTIONS.map((r) => {
        const active = mine === r.kind;
        return (
          <button
            key={r.kind}
            type="button"
            onClick={() => react(r.kind)}
            disabled={pending}
            aria-pressed={active}
            aria-label={r.label}
            title={r.label}
            className={`flex items-center justify-center rounded-full border px-4 py-2 text-lg leading-none transition disabled:opacity-60 ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]"
                : "border-black/15 bg-white hover:border-black/30"
            }`}
          >
            {r.emoji}
          </button>
        );
      })}
    </div>
  );
}
