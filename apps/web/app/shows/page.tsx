import Link from "next/link";
import { listUpcomingShows } from "@/lib/catalogue";
import { formatDayMonth } from "@/lib/format";

export const metadata = {
  title: "Spectacles à l'affiche — Scenes",
  description: "Les pièces de théâtre à venir à Paris.",
};

// DB-backed, always fresh for the POC.
export const dynamic = "force-dynamic";

export default async function ShowsPage() {
  const shows = await listUpcomingShows();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="font-display text-xl font-extrabold tracking-tight">
          Scenes
        </Link>
        <Link href="/sign-in" className="text-sm text-black/50 hover:text-black">
          Se connecter
        </Link>
      </header>

      <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight">
        À l&apos;affiche
      </h1>
      <p className="mt-2 text-black/60">
        Les prochaines pièces à Paris.
      </p>

      {shows.length === 0 ? (
        <p className="mt-10 text-black/50">Aucun spectacle à venir pour le moment.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {shows.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/shows/${s.slug}`}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:ring-black/15"
              >
                <div>
                  <span className="block font-display text-lg font-bold tracking-tight">
                    {s.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-black/50">
                    {s.nextVenue}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-sm font-medium">
                    dès le {formatDayMonth(s.nextStartsAt)}
                  </span>
                  <span className="mt-0.5 block text-xs text-black/40">
                    {s.upcomingCount} date{s.upcomingCount > 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
