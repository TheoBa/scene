import Link from "next/link";
import type { CompletionResult } from "@/lib/profile-completion";

// Progress nudge shown at the top of /mon-espace: a bar plus the still-missing
// checklist items as actionable links. No "hide forever" toggle in v1 (see
// docs/plans/2026-08-03-profile-completion-gauge.md — deliberately deferred);
// at 100% the missing list is simply empty, so the gauge quietly becomes just
// a "profil complet" line.
export function ProfileCompletionGauge({
  completion,
}: {
  completion: CompletionResult;
}) {
  const { percent, missing } = completion;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-base font-bold tracking-tight">
          {percent >= 100 ? "Profil complet 🎉" : "Complète ton profil"}
        </h2>
        <span className="text-sm font-semibold text-black/50">{percent}%</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {missing.length > 0 && (
        <ul className="mt-4 space-y-2">
          {missing.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-2 text-sm text-black/70 transition hover:text-black"
              >
                <span aria-hidden className="text-black/30">
                  →
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
