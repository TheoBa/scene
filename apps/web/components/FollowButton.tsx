"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type FollowActionResult =
  | { ok: true; following: boolean }
  | { ok: false; error: string };

// Suivre / Suivi toggle — generic over what's being followed (a person's
// pseudo, a venue's slug, an artist's slug): the three flows share all of the
// interaction logic and differ only in which server action gets called, so
// this takes the actions as props instead of being forked per follow kind.
// Logged-out clicks route to sign-in; otherwise it optimistically flips and
// persists via the given actions.
export function FollowButton({
  id,
  initialFollowing,
  signedIn,
  onFollow,
  onUnfollow,
}: {
  id: string;
  initialFollowing: boolean;
  signedIn: boolean;
  onFollow: (id: string) => Promise<FollowActionResult>;
  onUnfollow: (id: string) => Promise<FollowActionResult>;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = next ? await onFollow(id) : await onUnfollow(id);
      if (res.ok) setFollowing(res.following);
      else setFollowing(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
        following
          ? "border border-black/15 bg-white text-black/70 hover:border-black/30"
          : "bg-[var(--accent)] text-white hover:opacity-90"
      }`}
    >
      {following ? "Suivi ✓" : "Suivre"}
    </button>
  );
}
