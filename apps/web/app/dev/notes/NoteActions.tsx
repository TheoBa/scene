"use client";

import { useState, useTransition } from "react";
import { deleteDevNote, setNoteStatus } from "../actions";

// Triage controls for one note: flip new ↔ processed, or discard it.
export function NoteActions({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (deleted) return null;

  function toggle() {
    const next = status === "processed" ? "new" : "processed";
    setStatus(next);
    startTransition(async () => {
      const res = await setNoteStatus(id, next);
      if (!res.ok) setStatus(status);
    });
  }

  function remove() {
    if (!confirm("Supprimer cette note ?")) return;
    startTransition(async () => {
      const res = await deleteDevNote(id);
      if (res.ok) setDeleted(true);
    });
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-3 py-1 font-semibold transition disabled:opacity-50 ${
          status === "processed"
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-[var(--accent)] text-white hover:opacity-90"
        }`}
      >
        {status === "processed" ? "Traité ✓" : "Marquer traité"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-black/40 hover:text-red-600 disabled:opacity-50"
      >
        Supprimer
      </button>
    </div>
  );
}
