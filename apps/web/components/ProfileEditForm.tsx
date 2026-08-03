"use client";

import { useState, useTransition } from "react";

export type UpdateSelfProfileResult = { ok: true } | { ok: false; error: string };

export interface SelfProfileFields {
  bio: string;
  instagramHandle: string;
  websiteUrl: string;
}

// Self-edit box for bio/Instagram/website on /mon-espace — the fields the
// completion gauge nudges towards. Mirrors the toggle-to-edit interaction of
// ClaimedEntityEditForm (venue/artist self-edit) but for the user's own
// profile row instead.
export function ProfileEditForm({
  initial,
  onSave,
}: {
  initial: SelfProfileFields;
  onSave: (input: SelfProfileFields) => Promise<UpdateSelfProfileResult>;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await onSave(fields);
      if (res.ok) {
        setSaved(true);
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
        className="mt-4 rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm font-semibold text-black/70 transition hover:border-black/30"
      >
        {saved ? "Modifié ✓ — modifier à nouveau" : "Modifier ma bio / mes réseaux"}
      </button>
    );
  }

  return (
    <div className="mt-4 w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
      <label className="block text-sm font-medium text-black/70">
        Bio
        <textarea
          value={fields.bio}
          onChange={(e) => setFields({ ...fields, bio: e.target.value })}
          rows={3}
          placeholder="Quelques mots sur toi…"
          className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm text-black outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-black/70">
        Instagram
        <input
          type="text"
          value={fields.instagramHandle}
          onChange={(e) => setFields({ ...fields, instagramHandle: e.target.value })}
          placeholder="pseudo (sans @)"
          className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm text-black outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-black/70">
        Site web
        <input
          type="text"
          value={fields.websiteUrl}
          onChange={(e) => setFields({ ...fields, websiteUrl: e.target.value })}
          placeholder="https://…"
          className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm text-black outline-none focus:border-[var(--accent)]"
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-black/50 hover:text-black"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
