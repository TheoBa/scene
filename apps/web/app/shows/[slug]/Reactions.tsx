"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { REACTIONS, type ReactionKind } from "@/lib/reactions";
import { setReaction } from "./actions";

type Counts = Record<ReactionKind, number>;

// Apply a toggle/switch locally (mirrors the server logic) for optimistic UI.
function applyToggle(counts: Counts, mine: ReactionKind | null, kind: ReactionKind) {
  const next = { ...counts };
  let nextMine: ReactionKind | null;
  if (mine === kind) {
    next[kind] = Math.max(0, next[kind] - 1);
    nextMine = null;
  } else {
    if (mine) next[mine] = Math.max(0, next[mine] - 1);
    next[kind] += 1;
    nextMine = kind;
  }
  return { counts: next, mine: nextMine };
}

export function Reactions({
  slug,
  counts: initialCounts,
  mine: initialMine,
  signedIn,
}: {
  slug: string;
  counts: Counts;
  mine: ReactionKind | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState(initialMine);
  const [pending, startTransition] = useTransition();

  function react(kind: ReactionKind) {
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    // Optimistic: snapshot to revert if the server rejects.
    const prev = { counts, mine };
    const optimistic = applyToggle(counts, mine, kind);
    setCounts(optimistic.counts);
    setMine(optimistic.mine);

    startTransition(async () => {
      const res = await setReaction(slug, kind);
      if (res.ok) {
        setCounts(res.counts);
        setMine(res.mine);
      } else {
        setCounts(prev.counts);
        setMine(prev.mine);
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
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]"
                : "border-black/15 bg-white text-black/70 hover:border-black/30"
            }`}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            <span className="tabular-nums">{counts[r.kind]}</span>
          </button>
        );
      })}
    </div>
  );
}
