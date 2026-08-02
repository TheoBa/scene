import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getVenueBySlug, isFollowingVenue } from "@/lib/venues";
import { formatDateTime } from "@/lib/format";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { FollowButton } from "@/components/FollowButton";
import { ClaimForm } from "@/components/ClaimForm";
import { ClaimedEntityEditForm } from "@/components/ClaimedEntityEditForm";
import { VenueMapCard } from "@/components/VenueMapCard";
import { followVenue, unfollowVenue, updateVenueProfile } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return { title: "Salle introuvable — Scenes" };
  return {
    title: `${venue.name} — Scenes`,
    description: `Programme et infos pour ${venue.name} à Paris.`,
  };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const following = await isFollowingVenue(venue.id, session?.user.id);

  const MAX_DATES = 12;
  const shownDates = venue.upcoming.slice(0, MAX_DATES);
  const moreDates = venue.upcoming.length - shownDates.length;

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <SiteHeader />

      <Link
        href="/salle"
        className="mt-10 inline-block text-sm text-black/50 transition hover:text-black"
      >
        ← Toutes les salles
      </Link>

      <section className="relative mt-6 overflow-hidden rounded-3xl bg-neutral-900 shadow-sm ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterSrc(venue.imageUrl)}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/75 to-neutral-900/40" />

        <div className="relative flex flex-col items-center gap-8 p-8 sm:flex-row sm:items-end sm:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterSrc(venue.imageUrl)}
            alt={`Photo : ${venue.name}`}
            className="w-44 shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 sm:w-52"
          />

          <div className="flex min-w-0 flex-col items-center text-center text-white sm:items-start sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Salle
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {venue.name}
            </h1>
            {venue.address && <p className="mt-3 text-white/70">{venue.address}</p>}
            {venue.bio && <p className="mt-3 max-w-lg text-white/70">{venue.bio}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <FollowButton
                id={venue.slug}
                initialFollowing={following}
                signedIn={!!session}
                onFollow={followVenue}
                onUnfollow={unfollowVenue}
              />
              {venue.officialUrl && (
                <a
                  href={venue.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-white/90"
                >
                  Site officiel ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {venue.lat != null && venue.lng != null && (
        <VenueMapCard lat={venue.lat} lng={venue.lng} />
      )}

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Prochaines dates
        </h2>
        {venue.upcoming.length === 0 ? (
          <p className="mt-4 text-black/50">Aucune date à venir.</p>
        ) : (
          <>
            <ul className="mt-4 grid gap-2">
              {shownDates.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"
                >
                  <span className="font-medium capitalize">{formatDateTime(p.startsAt)}</span>
                  <Link
                    href={`/shows/${p.slug}`}
                    className="text-right text-sm text-[var(--accent)] hover:underline"
                  >
                    {p.name}
                  </Link>
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

      {venue.claimedByUserId === session?.user.id ? (
        <section className="mt-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
            Votre page
          </h2>
          <ClaimedEntityEditForm
            slug={venue.slug}
            initial={{
              bio: venue.bio ?? "",
              imageUrl: venue.imageUrl ?? "",
              officialUrl: venue.officialUrl ?? "",
            }}
            onSave={updateVenueProfile}
          />
        </section>
      ) : (
        !venue.claimedByUserId && (
          <section className="mt-12 flex flex-col items-center gap-3 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
              Vous gérez cette salle ?
            </h2>
            <ClaimForm
              targetType="venue"
              targetId={venue.id}
              targetSlug={venue.slug}
              signedIn={!!session}
            />
          </section>
        )
      )}
    </div>
  );
}
