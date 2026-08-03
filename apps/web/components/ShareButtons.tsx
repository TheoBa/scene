"use client";

import { useState } from "react";

// No explicit Messenger button: its share dialog requires a registered
// Facebook App ID we don't have. navigator.share already lists Messenger
// as a target on devices where it's installed.
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function share() {
    const url = window.location.href;
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled or share failed — nothing to do
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
