import { REACTIONS, type ReactionKind } from "@/lib/reactions";

// Community reaction distribution as horizontal bars. Read-only; sits beside the
// dates on a show page. Bars scale to the most-reacted emoji so the shape of the
// crowd's response reads at a glance.
export function ReactionHistogram({
  counts,
}: {
  counts: Record<ReactionKind, number>;
}) {
  const total = REACTIONS.reduce((sum, r) => sum + counts[r.kind], 0);
  const max = REACTIONS.reduce((m, r) => Math.max(m, counts[r.kind]), 0);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
        Réactions du public
      </h2>

      {total === 0 ? (
        <p className="mt-4 text-sm text-black/40">
          Aucune réaction pour l&apos;instant.
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {REACTIONS.map((r) => {
              const n = counts[r.kind];
              const pct = max > 0 ? (n / max) * 100 : 0;
              return (
                <li key={r.kind} className="flex items-center gap-3">
                  <span
                    className="w-6 shrink-0 text-center text-lg leading-none"
                    title={r.label}
                  >
                    {r.emoji}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                      style={{ width: n > 0 ? `max(0.5rem, ${pct}%)` : "0" }}
                    />
                  </div>
                  <span className="w-5 shrink-0 text-right text-sm tabular-nums text-black/50">
                    {n}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-xs text-black/40">
            {total} réaction{total > 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
