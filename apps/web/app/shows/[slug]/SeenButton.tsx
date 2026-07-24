"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSeen } from "./actions";

// "Je l'ai vu" toggle. Logged-out clicks route to sign-in; otherwise it
// optimistically flips and persists. The seen state is owned by AvisSection so
// that reacting can also flip it — reacting marks a show seen elsewhere.
export function SeenButton({
  slug,
  seen,
  onSeenChange,
  signedIn,
}: {
  slug: string;
  seen: boolean;
  onSeenChange: (seen: boolean) => void;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    const next = !seen;
    onSeenChange(next);
    startTransition(async () => {
      const res = await setSeen(slug, next);
      if (!res.ok) onSeenChange(!next);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={seen}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
          seen
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-black/15 bg-white text-black/70 hover:border-black/30"
        }`}
      >
        {seen ? "✓ Vu" : "Je l'ai vu"}
      </button>
      {seen && (
        <Link
          href="/mon-espace"
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Écrire un mot →
        </Link>
      )}
    </div>
  );
}
