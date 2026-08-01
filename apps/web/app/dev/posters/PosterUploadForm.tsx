"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPoster } from "./actions";

export function PosterUploadForm({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setJustUploaded(false);

    const formData = new FormData();
    formData.set("poster", file);
    startTransition(async () => {
      const res = await uploadPoster(eventId, formData);
      if (res.ok) {
        setJustUploaded(true);
      } else {
        setError(res.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <label className="cursor-pointer rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-semibold text-black/70 transition hover:bg-black/[0.1]">
        {pending ? "Envoi…" : "Changer l'affiche"}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={pending}
          onChange={onChange}
        />
      </label>
      {justUploaded && <span className="text-xs text-emerald-600">Affiche mise à jour ✓</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
