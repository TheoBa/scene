"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { FollowButton } from "@/components/FollowButton";
import { searchPeopleAction } from "./actions";
import type { PersonResult } from "@/lib/community";

// Find people by pseudo + copy your personal invite link. Search is debounced
// so it fires a server action ~once you stop typing, not on every keystroke.
export function FriendFinder({ myPseudo }: { myPseudo: string | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchPeopleAction(value);
        if (res.ok) setResults(res.people);
      });
    }, 300);
  }

  async function copyInvite() {
    if (!myPseudo) return;
    const url = `${window.location.origin}/u/${myPseudo}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context) — no-op; the link is visible.
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="font-display text-lg font-bold tracking-tight">
        Trouver des amis
      </h2>

      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher par pseudo…"
        className="mt-3 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />

      {results !== null && (
        <ul className="mt-3 divide-y divide-black/5">
          {results.length === 0 ? (
            <li className="py-3 text-sm text-black/40">
              {pending ? "Recherche…" : "Aucun profil trouvé."}
            </li>
          ) : (
            results.map((p) => (
              <li key={p.pseudo} className="flex items-center justify-between py-2.5">
                <Link
                  href={`/u/${p.pseudo}`}
                  className="flex items-center gap-2 text-sm font-medium hover:underline"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                    {p.pseudo.charAt(0).toUpperCase()}
                  </span>
                  {p.pseudo}
                </Link>
                <FollowButton
                  pseudo={p.pseudo}
                  initialFollowing={p.isFollowing}
                  signedIn
                />
              </li>
            ))
          )}
        </ul>
      )}

      {myPseudo && (
        <div className="mt-5 border-t border-black/5 pt-4">
          <p className="text-sm font-medium text-black/70">
            Votre lien d&apos;invitation
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/[0.04] px-3 py-2 text-xs text-black/60">
              {`/u/${myPseudo}`}
            </code>
            <button
              type="button"
              onClick={copyInvite}
              className="shrink-0 rounded-lg border border-black/15 px-3 py-2 text-xs font-medium text-black/70 transition hover:border-black/30"
            >
              {copied ? "Copié ✓" : "Copier"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-black/40">
            Partagez-le : en l&apos;ouvrant, vos amis pourront vous suivre.
          </p>
        </div>
      )}
    </div>
  );
}
