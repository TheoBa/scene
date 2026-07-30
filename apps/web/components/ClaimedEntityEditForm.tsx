"use client";

import { useState, useTransition } from "react";

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export interface ProfileFields {
  bio: string;
  imageUrl: string;
  officialUrl: string;
}

// Minimal self-edit for a claimed venue/artist page — bio, photo URL, official
// link only (no programme/show management in this iteration). Shared between
// /salle/[slug] and /artiste/[slug] since the two forms are identical apart
// from which action they call. A toggle-to-edit box, mirroring the
// AvisSection/mon-espace pattern used elsewhere for inline editing.
export function ClaimedEntityEditForm({
  slug,
  initial,
  onSave,
}: {
  slug: string;
  initial: ProfileFields;
  onSave: (slug: string, input: ProfileFields) => Promise<UpdateProfileResult>;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await onSave(slug, fields);
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
        className="rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm font-semibold text-black/70 transition hover:border-black/30"
      >
        {saved ? "Modifié ✓ — modifier à nouveau" : "Modifier cette page"}
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
      <label className="block text-sm font-medium text-black/70">
        Bio
        <textarea
          value={fields.bio}
          onChange={(e) => setFields({ ...fields, bio: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm text-black outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-black/70">
        Photo (URL)
        <input
          type="text"
          value={fields.imageUrl}
          onChange={(e) => setFields({ ...fields, imageUrl: e.target.value })}
          placeholder="https://…"
          className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm text-black outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-black/70">
        Lien officiel
        <input
          type="text"
          value={fields.officialUrl}
          onChange={(e) => setFields({ ...fields, officialUrl: e.target.value })}
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
