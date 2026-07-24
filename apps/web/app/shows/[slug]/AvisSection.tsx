"use client";

import { useState } from "react";
import type { ReactionKind } from "@/lib/reactions";
import { SeenButton } from "./SeenButton";
import { Reactions } from "./Reactions";

type Counts = Record<ReactionKind, number>;

// Ties the "Je l'ai vu" toggle and the emoji reactions together so they share a
// single seen state. Reacting marks the show seen (server-side too), which flips
// the button to "Vu" and reveals the "Écrire un mot →" link to Mon Espace.
export function AvisSection({
  slug,
  initialSeen,
  counts,
  mine,
  signedIn,
}: {
  slug: string;
  initialSeen: boolean;
  counts: Counts;
  mine: ReactionKind | null;
  signedIn: boolean;
}) {
  const [seen, setSeen] = useState(initialSeen);

  return (
    <div className="space-y-4">
      <SeenButton
        slug={slug}
        seen={seen}
        onSeenChange={setSeen}
        signedIn={signedIn}
      />
      <Reactions
        slug={slug}
        counts={counts}
        mine={mine}
        signedIn={signedIn}
        // Adding/switching a reaction implies you saw the show; removing it
        // (mine → null) never un-marks it, mirroring the server.
        onReaction={(next) => {
          if (next) setSeen(true);
        }}
      />
    </div>
  );
}
