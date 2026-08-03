import Link from "next/link";

// Inline prompt shown inside "Pour toi" when the personalization signal is too
// thin to fill the carousel — nudges the viewer toward the actions that would
// improve it (follow artists, complete their profile) instead of leaving the
// carousel empty or hidden.
export function PromptCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
    >
      <span className="text-sm font-semibold text-black/70 group-hover:text-[var(--accent)]">
        {label}
      </span>
      <span
        aria-hidden
        className="text-lg text-black/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
      >
        →
      </span>
    </Link>
  );
}
