import Link from "next/link";
import { listArtists } from "@/lib/artists";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";

export const metadata = {
  title: "Artistes — Scenes",
  description: "Les artistes et compagnies du théâtre parisien.",
};

// DB-backed, always fresh — artists are auto-generated from ingestion/seed.
export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  const artists = await listArtists();

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
            Artistes
          </h1>
          <p className="mt-3 max-w-md text-black/60">
            Auteurs, metteurs en scène, interprètes et compagnies.
          </p>
        </div>
        {artists.length > 0 && (
          <span className="hidden shrink-0 rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-black/60 sm:inline-block">
            {artists.length} artiste{artists.length > 1 ? "s" : ""}
          </span>
        )}
      </header>

      {artists.length === 0 ? (
        <p className="mt-16 text-black/50">Aucun artiste pour le moment.</p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {artists.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/artiste/${a.slug}`}
                className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
              >
                <div className="relative aspect-square overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={posterSrc(a.imageUrl)}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="px-3 py-2.5">
                  <h3 className="truncate text-sm font-semibold">{a.name}</h3>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
