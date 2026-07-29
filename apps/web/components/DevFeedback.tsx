"use client";

import { useEffect, useState, useTransition } from "react";
import { submitDevNote } from "@/app/dev/actions";
import { DEV_CATEGORIES, type DevCategory } from "@/lib/dev-notes";

// Dev-mode feedback widget. Only mounted for allowlisted users (the layout gates
// it). A floating button — or ⌘/Ctrl+I — toggles a panel to drop a bug/idea note
// tagged with the current page. Submissions land in dev_notes, triaged at
// /dev/notes.
export function DevFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DevCategory>("idea");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ⌘I (mac) / Ctrl+I toggles the panel; Esc closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit() {
    const value = body.trim();
    if (!value) return;
    setError(null);
    const path = window.location.pathname + window.location.search;
    startTransition(async () => {
      const res = await submitDevNote({ body: value, category, path });
      if (res.ok) {
        setBody("");
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Dev mode — laisser une note (⌘I)"
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black text-lg text-white shadow-lg transition hover:scale-105"
      >
        🛠️
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold">Dev mode</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-black/40 hover:text-black"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex gap-1.5">
            {DEV_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  category === c.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-black/[0.04] text-black/60 hover:bg-black/[0.08]"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            autoFocus
            placeholder="Une idée, un bug, une remarque…"
            className="mt-3 w-full resize-y rounded-xl border border-black/15 bg-white p-3 text-sm outline-none focus:border-[var(--accent)]"
          />

          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

          <div className="mt-2 flex items-center justify-between">
            <a
              href="/dev/notes"
              className="text-xs font-medium text-black/40 hover:text-black/70"
            >
              Voir les notes →
            </a>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !body.trim()}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : done ? "Envoyé ✓" : "Envoyer"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
