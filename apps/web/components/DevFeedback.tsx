"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitDevNote } from "@/app/dev/actions";
import {
  DEV_ATTACHMENT_ACCEPT,
  DEV_ATTACHMENT_MAX_BYTES,
  DEV_ATTACHMENT_MAX_COUNT,
  DEV_CATEGORIES,
  isAllowedAttachmentMimeType,
  type DevCategory,
} from "@/lib/dev-notes";

interface PendingAttachment {
  key: string; // client-only, for React keys / removal — not persisted
  filename: string;
  mimeType: string;
  dataUrl: string;
}

// Dev-mode feedback widget. Only mounted for allowlisted users (the layout gates
// it). A floating button — or ⌘/Ctrl+I — toggles a panel to drop a bug/idea note
// tagged with the current page, optionally with one or more documents attached
// (a screenshot taken elsewhere, a PDF, …). Submissions land in dev_notes,
// triaged at /dev/notes.
export function DevFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DevCategory>("idea");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await submitDevNote({
        body: value,
        category,
        path,
        attachments: attachments.map(({ filename, mimeType, dataUrl }) => ({
          filename,
          mimeType,
          dataUrl,
        })),
      });
      if (res.ok) {
        setBody("");
        setAttachments([]);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      } else {
        setError(res.error);
      }
    });
  }

  // Read and validate a batch of files (from the picker, a drop, or a paste),
  // appending whatever passes to the pending attachment list. Validates
  // against a snapshot of the current count rather than inside the
  // setAttachments updater — kicking off FileReaders (a side effect) from
  // within a functional updater would run twice under React StrictMode's
  // dev-mode double-invocation, double-adding every file.
  function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);

    const room = DEV_ATTACHMENT_MAX_COUNT - attachments.length;
    if (room <= 0) {
      setError(`Maximum ${DEV_ATTACHMENT_MAX_COUNT} documents.`);
      return;
    }
    const accepted: File[] = [];
    for (const file of list) {
      if (accepted.length >= room) break;
      if (!isAllowedAttachmentMimeType(file.type)) {
        setError(`Type non supporté : ${file.name}`);
        continue;
      }
      if (file.size > DEV_ATTACHMENT_MAX_BYTES) {
        setError(`Trop volumineux (>8 Mo) : ${file.name}`);
        continue;
      }
      accepted.push(file);
    }
    for (const file of accepted) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") return;
        setAttachments((prev) => [
          ...prev,
          {
            key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            filename: file.name || "document",
            mimeType: file.type,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }

  function removeAttachment(key: string) {
    setAttachments((current) => current.filter((a) => a.key !== key));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function onPaste(e: React.ClipboardEvent<HTMLElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) addFiles(files);
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
        <div
          ref={panelRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onPaste={onPaste}
          className={`fixed bottom-20 right-5 z-50 w-80 rounded-2xl bg-white p-4 shadow-2xl ring-1 transition ${
            dragOver ? "ring-2 ring-[var(--accent)]" : "ring-1 ring-black/10"
          }`}
        >
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

          {attachments.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li key={a.key} className="relative">
                  {a.mimeType.startsWith("image/") ? (
                    <a href={a.dataUrl} target="_blank" rel="noreferrer">
                      <img
                        src={a.dataUrl}
                        alt={a.filename}
                        className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10"
                      />
                    </a>
                  ) : (
                    <a
                      href={a.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={a.filename}
                      className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-black/[0.04] px-1 ring-1 ring-black/10"
                    >
                      <span className="text-lg">📄</span>
                      <span className="w-full truncate text-center text-[9px] text-black/60">
                        {a.filename}
                      </span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.key)}
                    aria-label={`Retirer ${a.filename}`}
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] text-white hover:bg-red-600"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={DEV_ATTACHMENT_ACCEPT}
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= DEV_ATTACHMENT_MAX_COUNT}
            className="mt-2 rounded-lg bg-black/[0.04] px-2 py-1.5 text-xs font-semibold text-black/60 transition hover:bg-black/[0.08] disabled:opacity-50"
          >
            📎 Joindre un document
          </button>
          <p className="mt-1 text-[10px] text-black/40">
            Ou glissez-déposez, ou collez (⌘V) une image copiée.
          </p>

          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !body.trim()}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : done ? "Envoyé ✓" : "Envoyer"}
            </button>
          </div>

          <div className="mt-3 flex gap-1.5 border-t border-black/10 pt-3">
            <Link
              href="/dev/notes"
              className="flex-1 rounded-lg bg-black/[0.04] px-2 py-1.5 text-center text-xs font-semibold text-black/60 transition hover:bg-black/[0.08]"
            >
              Notes
            </Link>
            <Link
              href="/dev/data-quality"
              className="flex-1 rounded-lg bg-black/[0.04] px-2 py-1.5 text-center text-xs font-semibold text-black/60 transition hover:bg-black/[0.08]"
            >
              Data quality
            </Link>
            <Link
              href="/dev/posters"
              className="flex-1 rounded-lg bg-black/[0.04] px-2 py-1.5 text-center text-xs font-semibold text-black/60 transition hover:bg-black/[0.08]"
            >
              Posters
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
