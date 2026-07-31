import Link from "next/link";
import { listVenues } from "@/lib/venues";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";

export const metadata = {
  title: "Salles — Scenes",
  description: "Les théâtres et salles de spectacle à Paris.",
};

// DB-backed, always fresh — venues are auto-generated from ingestion/seed.
export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const venues = await listVenues();

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
            Salles
          </h1>
          <p className="mt-3 max-w-md text-black/60">
            Les théâtres et lieux qui accueillent les spectacles.
          </p>
        </div>
        {venues.length > 0 && (
          <span className="hidden shrink-0 rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-black/60 sm:inline-block">
            {venues.length} salle{venues.length > 1 ? "s" : ""}
          </span>
        )}
      </header>

      {venues.length === 0 ? (
        <p className="mt-16 text-black/50">Aucune salle pour le moment.</p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <li key={v.slug}>
              <VenueCardView venue={v} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VenueCardView({
  venue,
}: {
  venue: { slug: string; name: string; imageUrl: string | null; upcomingCount: number };
}) {
  return (
    <Link
      href={`/salle/${venue.slug}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterSrc(venue.imageUrl)}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="font-display text-lg font-bold leading-snug tracking-tight">
            {venue.name}
          </h3>
        </div>
      </div>
      <div className="px-4 py-3">
        <span className="text-sm text-black/60">
          {venue.upcomingCount > 0
            ? `${venue.upcomingCount} date${venue.upcomingCount > 1 ? "s" : ""} à venir`
            : "Aucune date à venir"}
        </span>
      </div>
    </Link>
  );
}
