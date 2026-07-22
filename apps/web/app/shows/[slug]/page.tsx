import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getShowBySlug } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) return { title: "Spectacle introuvable — Scenes" };
  return {
    title: `${show.name} — Scenes`,
    description: `Dates et lieux pour ${show.name} à Paris.`,
  };
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <Link href="/shows" className="text-sm text-black/50 hover:text-black">
        ← Tous les spectacles
      </Link>

      <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight">
        {show.name}
      </h1>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Prochaines dates
        </h2>
        {show.performances.length === 0 ? (
          <p className="mt-4 text-black/50">Aucune date à venir.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {show.performances.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <span className="font-medium capitalize">
                  {formatDateTime(p.startsAt)}
                </span>
                <span className="text-right text-sm text-black/50">
                  {p.venue}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ratings and the ticketing affiliate link land here in a later phase. */}
    </main>
  );
}
