import { notFound } from "next/navigation";
import { getDevAccess } from "@/lib/dev-access";
import {
  getDataQuality,
  type Coverage,
  type RunRow,
  type SourceStats,
} from "@/lib/data-quality-query";
import { formatDateTime } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Qualité des données — Scenes" };
export const dynamic = "force-dynamic";

// The optional catalogue fields we track coverage on, in priority order. Keys
// match MetricsSnapshot.events.coverage; labels are what shows in the bars.
const FIELD_LABELS: {
  key: "imageUrl" | "author" | "director" | "durationMinutes" | "officialUrl" | "tags";
  label: string;
}[] = [
  { key: "imageUrl", label: "Affiches" },
  { key: "author", label: "Auteur" },
  { key: "director", label: "Metteur en scène" },
  { key: "durationMinutes", label: "Durée" },
  { key: "officialUrl", label: "Lien officiel" },
  { key: "tags", label: "Tags" },
];

export default async function DataQualityPage() {
  // 404 rather than redirect: don't hint the route exists to anyone else.
  const dev = await getDevAccess();
  if (!dev) notFound();

  const { metrics, metricsAt, runs } = await getDataQuality();

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <SiteHeader />

      <header className="mt-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Qualité des données
        </h1>
        <p className="mt-2 text-black/60">
          Couverture et complétude du catalogue ingéré — où porter l&apos;effort
          d&apos;enrichissement.
          {metricsAt ? ` Dernier calcul : ${formatDateTime(metricsAt)}.` : ""}
        </p>
      </header>

      {!metrics ? (
        <p className="mt-12 rounded-2xl bg-white p-8 text-center text-black/60 shadow-sm ring-1 ring-black/5">
          Aucun run d&apos;ingestion avec métriques pour l&apos;instant. Lancez{" "}
          <code className="rounded bg-black/[0.05] px-1">npm run ingest -w apps/worker</code>.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Volumes */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Spectacles" value={metrics.events.total} />
            <Stat label="Lieux" value={metrics.venues.total} />
            <Stat label="Représentations" value={metrics.performances.total} />
            <Stat label="À venir" value={metrics.performances.upcoming} />
          </section>

          {/* Coverage bars */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-sm font-semibold text-black/70">
              Complétude des champs
            </h2>
            <div className="mt-4 space-y-3">
              {FIELD_LABELS.map(({ key, label }) => (
                <Bar key={key} label={label} c={metrics.events.coverage[key]} />
              ))}
              <Bar label="Adresse (lieux)" c={metrics.venues.address} />
            </div>
          </section>

          {/* Per-source */}
          {metrics.sources.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-black/70">Par source</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {metrics.sources.map((s) => (
                  <SourceCard key={s.source} s={s} />
                ))}
              </ul>
            </section>
          )}

          {/* Run history */}
          {runs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-black/70">Runs récents</h2>
              <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-black/50">
                    <tr className="border-b border-black/5">
                      <th className="px-4 py-2 font-medium">Démarré</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                      <th className="px-4 py-2 text-right font-medium">Appels</th>
                      <th className="px-4 py-2 text-right font-medium">Ingérés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <RunRowView key={r.id} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="text-2xl font-extrabold tabular-nums">
        {value.toLocaleString("fr-FR")}
      </div>
      <div className="mt-1 text-xs text-black/50">{label}</div>
    </div>
  );
}

function Bar({ label, c }: { label: string; c: Coverage }) {
  const pct = Math.round(c.pct * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-black/70">{label}</span>
        <span className="tabular-nums text-black/50">
          {pct}% · {c.present.toLocaleString("fr-FR")}/{c.total.toLocaleString("fr-FR")}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

function SourceCard({ s }: { s: SourceStats }) {
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{s.source}</span>
        <span className="text-xs text-black/50">
          {s.rows.toLocaleString("fr-FR")} enreg.
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-black/70">
        <Cell label="Spectacles" value={s.events} />
        <Cell label="Non résolus" value={s.unresolved} />
        <Cell label="Résolus" value={s.resolved} />
        <Cell label="Périmés" value={s.stale} />
      </dl>
    </li>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-black/50">{label}</dt>
      <dd className="text-right tabular-nums">{value.toLocaleString("fr-FR")}</dd>
    </>
  );
}

function RunRowView({ r }: { r: RunRow }) {
  return (
    <tr className="border-b border-black/5 last:border-0" title={r.error ?? undefined}>
      <td className="px-4 py-2 text-black/70">{formatDateTime(r.startedAt)}</td>
      <td className="px-4 py-2 text-black/70">{r.source}</td>
      <td className="px-4 py-2">
        <StatusPill status={r.status} />
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-black/70">{r.requests}</td>
      <td className="px-4 py-2 text-right tabular-nums text-black/70">
        {r.sourceEventsUpserted}
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "error"
        ? "bg-red-100 text-red-700"
        : "bg-black/[0.06] text-black/60";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
