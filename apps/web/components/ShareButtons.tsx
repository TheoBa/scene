"use client";

import { useState } from "react";

// No explicit Messenger button: its share dialog requires a registered
// Facebook App ID we don't have. navigator.share already lists Messenger
// as a target on devices where it's installed.
//
// Instagram Stories has no "share a link" API the way WhatsApp does — it only
// accepts an image via a native share sheet (Web Share API with `files`) or,
// on iOS, a pasteboard handoff that requires a registered Meta App ID we
// don't have yet. So "Partager en story" reuses navigator.share but hands it
// the poster image instead of a URL, and is hidden entirely (rather than
// shown broken) on browsers that can't share files — desktop and, until we
// register an App ID, iOS Safari. See docs/plans/2026-08-03-instagram-story-share.md.
export function ShareButtons({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [storySharing, setStorySharing] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  // Feature-detect file sharing specifically: navigator.share existing isn't
  // enough (e.g. desktop Safari has it but can't share files), and
  // navigator.canShare is the documented way to check before constructing
  // the File — see the "canNativeShare" pattern this mirrors above.
  const canShareStory =
    canNativeShare &&
    typeof navigator.canShare === "function" &&
    !!imageUrl;

  async function share() {
    const url = window.location.href;
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled or share failed — nothing to do
    }
  }

  async function shareStory() {
    if (!imageUrl) return;
    setStorySharing(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "affiche.jpg", {
        type: blob.type || "image/jpeg",
      });
      if (!navigator.canShare?.({ files: [file] })) return;
      await navigator.share({ files: [file], title });
    } catch {
      // user cancelled, fetch failed, or share failed — nothing to do
    } finally {
      setStorySharing(false);
    }
  }

  async function copyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function whatsappHref() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canNativeShare ? (
        <button
          type="button"
          onClick={share}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-5 py-2.5 text-sm font-semibold text-black/70 ring-1 ring-black/10 transition hover:bg-black/[0.08]"
        >
          Partager
        </button>
      ) : (
        <a
          href={whatsappHref()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-5 py-2.5 text-sm font-semibold text-black/70 ring-1 ring-black/10 transition hover:bg-black/[0.08]"
        >
          WhatsApp
        </a>
      )}

      {canShareStory && (
        <button
          type="button"
          onClick={shareStory}
          disabled={storySharing}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-5 py-2.5 text-sm font-semibold text-black/70 ring-1 ring-black/10 transition hover:bg-black/[0.08] disabled:opacity-60"
        >
          {storySharing ? "…" : "Partager en story"}
        </button>
      )}

      <button
        type="button"
        onClick={copyLink}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-5 py-2.5 text-sm font-semibold text-black/70 ring-1 ring-black/10 transition hover:bg-black/[0.08]"
      >
        {copied ? "Copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
