"use client";

import { useState, useTransition } from "react";
import { decideClaim } from "../actions";

// Triage controls for one claim: approve or reject. Mirrors dev/notes'
// NoteActions.tsx toggle pattern.
export function ClaimActions({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, startTransition] = useTransition();

  if (status !== "pending") {
    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          status === "approved"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-black/[0.06] text-black/50"
        }`}
      >
        {status === "approved" ? "Approuvée ✓" : "Refusée"}
      </span>
    );
  }

  function decide(decision: "approved" | "rejected") {
    setStatus(decision);
    startTransition(async () => {
      const res = await decideClaim(id, decision);
      if (!res.ok) setStatus("pending");
    });
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={() => decide("approved")}
        disabled={pending}
        className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
      >
        Approuver
      </button>
      <button
        type="button"
        onClick={() => decide("rejected")}
        disabled={pending}
        className="text-black/40 hover:text-red-600 disabled:opacity-50"
      >
        Refuser
      </button>
    </div>
  );
}
