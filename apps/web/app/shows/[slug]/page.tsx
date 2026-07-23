import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getShowBySlug, getEventReactions } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/format";
import { Reactions } from "./Reactions";

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

  const session = await auth.api.getSession({ headers: await headers() });
  const reactions = await getEventReactions(show.id, session?.user.id);

  const MAX_DATES = 12;
  const shownDates = show.performances.slice(0, MAX_DATES);
  const moreDates = show.performances.length - shownDates.length;
  const subtitle = [show.author, show.director].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <Link href="/shows" className="text-sm text-black/50 hover:text-black">
        ← Tous les spectacles
      </Link>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        {show.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/posters/${show.imageUrl}`}
            alt={`Affiche : ${show.name}`}
            className="w-44 shrink-0 self-center rounded-xl object-cover shadow-sm ring-1 ring-black/5 sm:self-start"
          />
        )}
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {show.name}
          </h1>
          {subtitle && <p className="mt-2 text-black/60">{subtitle}</p>}

          {(show.tags.length > 0 || show.durationMinutes) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {show.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-black/60"
                >
                  {t}
                </span>
              ))}
              {show.durationMinutes && (
                <span className="text-xs text-black/40">
                  {show.durationMinutes} min
                </span>
              )}
            </div>
          )}

          {show.officialUrl && (
            <a
              href={show.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Site officiel du spectacle ↗
            </a>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Prochaines dates
        </h2>
        {show.performances.length === 0 ? (
          <p className="mt-4 text-black/50">Aucune date à venir.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-2">
              {shownDates.map((p, i) => (
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
            {moreDates > 0 && (
              <p className="mt-3 text-sm text-black/40">
                + {moreDates} autre{moreDates > 1 ? "s" : ""} date
                {moreDates > 1 ? "s" : ""} à venir
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Réactions
        </h2>
        <div className="mt-4">
          <Reactions
            slug={slug}
            counts={reactions.counts}
            mine={reactions.mine}
            signedIn={!!session}
          />
        </div>
      </section>

      {/* The ticketing affiliate link lands here in a later phase. */}
    </main>
  );
}
