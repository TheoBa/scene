import Link from "next/link";
import { posterSrc } from "@/lib/poster";
import type { VenueCard } from "@/lib/venues";

// Compact venue tile for the "Salles près de chez vous" carousel — mirrors
// /salle's VenueCardView, narrowed for a fixed-width snap point.
export function VenueCardTile({ venue }: { venue: VenueCard }) {
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
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <h3 className="font-display text-sm font-bold leading-snug tracking-tight">
            {venue.name}
          </h3>
        </div>
      </div>
      <div className="px-3 py-2">
        <span className="text-xs text-black/60">
          {venue.upcomingCount > 0
            ? `${venue.upcomingCount} date${venue.upcomingCount > 1 ? "s" : ""}`
            : "Aucune date à venir"}
        </span>
      </div>
    </Link>
  );
}
