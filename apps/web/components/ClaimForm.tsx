"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitClaim, type ClaimTargetType } from "@/lib/claims";

// "Revendiquer cette page" CTA + form, shared between /salle/[slug] and
// /artiste/[slug] (identical apart from which target they submit against).
// Manual review only — no auto-verification, just files the request.
export function ClaimForm({
  targetType,
  targetId,
  targetSlug,
  signedIn,
}: {
  targetType: ClaimTargetType;
  targetId: string;
  targetSlug: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openForm() {
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    setOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitClaim(targetType, targetId, targetSlug, message);
      if (res.ok) {
        setSubmitted(true);
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (submitted) {
    return (
      <p className="text-sm text-black/50">
        Demande envoyée — en attente de vérification.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm font-semibold text-black/70 transition hover:border-black/30"
      >
        Revendiquer cette page
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
      <p className="text-sm font-medium text-black/70">
        Expliquez votre lien avec cette page (rôle, email pro, preuve…)
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-xl border border-black/15 px-3 py-2 text-sm text-black outline-none focus:border-[var(--accent)]"
        placeholder="Je suis le directeur de cette salle, contactez-moi à…"
      />
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
          Envoyer
        </button>
      </div>
    </div>
  );
}
