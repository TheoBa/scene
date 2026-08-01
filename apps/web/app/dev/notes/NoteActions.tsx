"use client";

import { useState, useTransition } from "react";
import { deleteDevNote, setNoteStatus } from "../actions";
import { DEV_NOTE_STATUSES } from "@/lib/dev-notes";

const STATUS_LABEL = Object.fromEntries(
  DEV_NOTE_STATUSES.map((s) => [s.value, s.label]),
);

// Manual triage controls for one note. The plan-from-notes / build-from-plan
// skills drive a note through untackled → waiting_for_input/plan_done →
// implemented_pending_review on their own (via /api/dev/notes); the only
// manual flip left here is closing it out once you've reviewed the merged
// PR (→ done), or reopening a `done` note by mistake.
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
    const next = status === "done" ? "untackled" : "done";
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

  const inProgress = status !== "untackled" && status !== "done";

  return (
    <div className="flex items-center gap-3 text-xs">
      {inProgress && (
        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-black/60">
          {STATUS_LABEL[status] ?? status}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-3 py-1 font-semibold transition disabled:opacity-50 ${
          status === "done"
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-[var(--accent)] text-white hover:opacity-90"
        }`}
      >
        {status === "done" ? "Traité ✓" : "Marquer traité"}
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
