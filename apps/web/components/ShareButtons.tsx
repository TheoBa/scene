"use client";

import { useState } from "react";
import { Facebook, Instagram, Link as LinkIcon, Check } from "lucide-react";

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.85.5 3.62 1.44 5.19L2 22l5.06-1.53a9.87 9.87 0 0 0 4.98 1.32h.005c5.46 0 9.906-4.45 9.906-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm5.432 12.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    </svg>
  );
}

// Instagram has no web intent for sharing an arbitrary link — the only
// native option is a Story share of an image via the Web Share API's
// `files` support, feature-detected via navigator.canShare({ files }).
// The bubble is hidden entirely (not shown broken) where that's
// unsupported: desktop browsers, and iOS Safari until we register a Meta
// App ID. See docs/plans/2026-08-03-instagram-story-share.md.
export function ShareButtons({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [storySharing, setStorySharing] = useState(false);
  const canShareStory =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    !!imageUrl;

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

  const url = typeof window !== "undefined" ? window.location.href : "";
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  const bubble =
    "inline-flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-white/15 transition hover:brightness-110 disabled:opacity-60";

  return (
    <div className="w-fit rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
        Partager
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Partager sur X"
          className={`${bubble} bg-black`}
        >
          <XIcon size={18} />
        </a>

        {canShareStory && (
          <button
            type="button"
            onClick={shareStory}
            disabled={storySharing}
            aria-label="Partager en story Instagram"
            className={`${bubble} bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5]`}
          >
            <Instagram size={18} />
          </button>
        )}

        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Partager sur Facebook"
          className={`${bubble} bg-[#1877F2]`}
        >
          <Facebook size={18} />
        </a>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Partager sur WhatsApp"
          className={`${bubble} bg-[#25D366]`}
        >
          <WhatsAppIcon size={18} />
        </a>

        <div className="relative">
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copier le lien"
            className={`${bubble} bg-white/10`}
          >
            {copied ? <Check size={18} /> : <LinkIcon size={18} />}
          </button>
          {copied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white">
              Copié !
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
