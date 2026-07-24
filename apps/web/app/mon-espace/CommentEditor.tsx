"use client";

import { useState, useTransition } from "react";
import { saveComment, deleteComment } from "./actions";

// Add / edit / delete the user's one comment on a show they've seen.
export function CommentEditor({
  slug,
  initialComment,
}: {
  slug: string;
  initialComment: string | null;
}) {
  const [comment, setComment] = useState(initialComment);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialComment ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const value = draft.trim();
    startTransition(async () => {
      const res = await saveComment(slug, value);
      if (res.ok) {
        setComment(res.comment);
        setEditing(false);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteComment(slug);
      if (res.ok) {
        setComment(null);
        setDraft("");
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="mt-3">
        {comment ? (
          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="whitespace-pre-wrap text-sm text-black/80">{comment}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDraft(comment);
                  setEditing(true);
                }}
                className="font-medium text-[var(--accent)] hover:underline"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="text-black/40 hover:text-black/70 disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            + Ajouter un mot
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={2000}
        autoFocus
        placeholder="Qu'en avez-vous pensé ?"
        className="w-full resize-y rounded-xl border border-black/15 bg-white p-3 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-sm text-black/50 hover:text-black disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
