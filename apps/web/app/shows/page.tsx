import Link from "next/link";
import { listUpcomingShows, type ShowCard } from "@/lib/catalogue";
import { formatDayMonth } from "@/lib/format";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";

export const metadata = {
  title: "Spectacles à l'affiche — Scenes",
  description: "Les pièces de théâtre à venir à Paris.",
};

// DB-backed, always fresh for the POC.
export const dynamic = "force-dynamic";

export default async function ShowsPage() {
  const shows = await listUpcomingShows();
  const [featured, ...rest] = shows;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <SiteHeader />
      <TabNav />

      <header className="mt-10 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Le théâtre à Paris
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            À l&apos;affiche
          </h1>
          <p className="mt-3 max-w-md text-black/60">
            Les prochaines pièces à voir sur les scènes parisiennes.
          </p>
        </div>
        {shows.length > 0 && (
          <span className="hidden shrink-0 rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-black/60 sm:inline-block">
            {shows.length} spectacle{shows.length > 1 ? "s" : ""}
          </span>
        )}
      </header>

      {shows.length === 0 ? (
        <p className="mt-16 text-black/50">
          Aucun spectacle à venir pour le moment.
        </p>
      ) : (
        <div className="mt-10 space-y-10">
          {featured && <FeaturedShow show={featured} />}

          {rest.length > 0 && (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((s) => (
                <li key={s.slug}>
                  <ShowPoster show={s} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Large horizontal hero for the soonest upcoming show.
function FeaturedShow({ show }: { show: ShowCard }) {
  return (
    <Link
      href={`/shows/${show.slug}`}
      className="group grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-xl hover:ring-black/10 sm:grid-cols-[minmax(0,15rem)_1fr]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/5 sm:aspect-auto">
        <Poster imageUrl={show.imageUrl} />
      </div>

      <div className="flex flex-col justify-center gap-3 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Prochaine séance · dès le {formatDayMonth(show.nextStartsAt)}
        </p>
        <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
          {show.name}
        </h2>
        {show.author && (
          <p className="text-black/60">de {show.author}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/50">
          <span>{show.nextVenue}</span>
          <span aria-hidden className="text-black/20">
            •
          </span>
          <span>
            {show.upcomingCount} date{show.upcomingCount > 1 ? "s" : ""} à venir
          </span>
        </div>
        <span className="mt-4 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[var(--accent)]">
          Voir les dates
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

// Poster-forward card used in the discovery grid.
function ShowPoster({ show }: { show: ShowCard }) {
  return (
    <Link
      href={`/shows/${show.slug}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/5">
        <Poster imageUrl={show.imageUrl} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-black shadow-sm backdrop-blur">
          dès le {formatDayMonth(show.nextStartsAt)}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="font-display text-lg font-bold leading-snug tracking-tight">
            {show.name}
          </h3>
          {show.author && (
            <p className="mt-0.5 text-sm text-white/70">{show.author}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="truncate text-sm text-black/60">{show.nextVenue}</span>
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/50">
          {show.upcomingCount} date{show.upcomingCount > 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}

// Shared poster image. Falls back to a general poster when a show has no artwork,
// so freshly-ingested shows (no committed poster yet) still render cleanly.
function Poster({ imageUrl }: { imageUrl: string | null }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={posterSrc(imageUrl)}
      alt=""
      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
    />
  );
}
