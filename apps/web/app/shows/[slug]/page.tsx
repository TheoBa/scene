import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getShowBySlug, getEventReactions } from "@/lib/catalogue";
import { getUserSeen } from "@/lib/espace";
import { formatDateTime } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { Reactions } from "./Reactions";
import { SeenButton } from "./SeenButton";

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
  const seen = session ? await getUserSeen(show.id, session.user.id) : false;

  const MAX_DATES = 12;
  const shownDates = show.performances.slice(0, MAX_DATES);
  const moreDates = show.performances.length - shownDates.length;
  const subtitle = [show.author, show.director].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <SiteHeader />

      <Link
        href="/shows"
        className="mt-10 inline-block text-sm text-black/50 transition hover:text-black"
      >
        ← Tous les spectacles
      </Link>

      {/* Poster-forward hero: the artwork bleeds behind a dark scrim with the
          sharp poster and the title sitting on top. */}
      <section className="relative mt-6 overflow-hidden rounded-3xl bg-neutral-900 shadow-sm ring-1 ring-black/5">
        {show.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/posters/${show.imageUrl}`}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/75 to-neutral-900/40" />

        <div className="relative flex flex-col items-center gap-8 p-8 sm:flex-row sm:items-end sm:p-10">
          {show.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/posters/${show.imageUrl}`}
              alt={`Affiche : ${show.name}`}
              className="w-44 shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 sm:w-52"
            />
          ) : (
            <div className="flex aspect-[3/4] w-44 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 sm:w-52">
              <span className="font-display text-2xl font-bold text-white/20">
                Scenes
              </span>
            </div>
          )}

          <div className="flex min-w-0 flex-col items-center text-center text-white sm:items-start sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              À l&apos;affiche
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {show.name}
            </h1>
            {subtitle && <p className="mt-3 text-white/70">{subtitle}</p>}

            {(show.tags.length > 0 || show.durationMinutes) && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {show.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10"
                  >
                    {t}
                  </span>
                ))}
                {show.durationMinutes && (
                  <span className="text-xs text-white/50">
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
                className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-white/90"
              >
                Site officiel du spectacle ↗
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Prochaines dates
        </h2>
        {show.performances.length === 0 ? (
          <p className="mt-4 text-black/50">Aucune date à venir.</p>
        ) : (
          <>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {shownDates.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"
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

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Votre avis
        </h2>
        <div className="mt-4 space-y-4">
          <SeenButton slug={slug} initialSeen={seen} signedIn={!!session} />
          <Reactions
            slug={slug}
            counts={reactions.counts}
            mine={reactions.mine}
            signedIn={!!session}
          />
        </div>
      </section>

      {/* The ticketing affiliate link lands here in a later phase. */}
    </div>
  );
}
