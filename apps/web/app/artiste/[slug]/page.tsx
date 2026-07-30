import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getArtistBySlug, isFollowingArtist } from "@/lib/artists";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { FollowButton } from "@/components/FollowButton";
import { followArtist, unfollowArtist } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return { title: "Artiste introuvable — Scenes" };
  return {
    title: `${artist.name} — Scenes`,
    description: `Les spectacles de ${artist.name} à Paris.`,
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const following = await isFollowingArtist(artist.id, session?.user.id);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <SiteHeader />

      <Link
        href="/artiste"
        className="mt-10 inline-block text-sm text-black/50 transition hover:text-black"
      >
        ← Tous les artistes
      </Link>

      <section className="mt-6 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="relative aspect-square w-40 shrink-0 overflow-hidden rounded-2xl bg-black/5 shadow-sm ring-1 ring-black/5 sm:w-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterSrc(artist.imageUrl)}
            alt={`Photo : ${artist.name}`}
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Artiste
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {artist.name}
          </h1>
          {artist.bio && <p className="mt-3 max-w-lg text-black/60">{artist.bio}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <FollowButton
              id={artist.slug}
              initialFollowing={following}
              signedIn={!!session}
              onFollow={followArtist}
              onUnfollow={unfollowArtist}
            />
            {artist.officialUrl && (
              <a
                href={artist.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-black/80 transition hover:bg-black/10"
              >
                Site officiel ↗
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Spectacles
        </h2>
        {artist.shows.length === 0 ? (
          <p className="mt-4 text-black/50">Aucun spectacle connu pour l&apos;instant.</p>
        ) : (
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artist.shows.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/shows/${s.slug}`}
                  className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={posterSrc(s.imageUrl)}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="px-4 py-3">
                    <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Claim CTA lands here in a later slice. */}
    </div>
  );
}
