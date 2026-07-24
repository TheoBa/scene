"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow } from "@/app/communaute/actions";

// Suivre / Suivi toggle. Logged-out clicks route to sign-in; otherwise it
// optimistically flips and persists via the follow/unfollow actions.
export function FollowButton({
  pseudo,
  initialFollowing,
  signedIn,
}: {
  pseudo: string;
  initialFollowing: boolean;
  signedIn: boolean;
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
      const res = next ? await follow(pseudo) : await unfollow(pseudo);
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
