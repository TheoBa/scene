import Link from "next/link";
import { formatDayMonth } from "@/lib/format";
import { posterSrc } from "@/lib/poster";
import type { ShowCard } from "@/lib/catalogue";

// Compact poster tile for a carousel item — same visual language as the
// former discovery grid's ShowPoster, just narrower to fit a fixed-width
// snap point instead of a grid cell.
export function ShowPosterCard({ show }: { show: ShowCard }) {
  return (
    <Link
      href={`/shows/${show.slug}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterSrc(show.imageUrl)}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-black shadow-sm backdrop-blur">
          dès le {formatDayMonth(show.nextStartsAt)}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <h3 className="font-display text-sm font-bold leading-snug tracking-tight">
            {show.name}
          </h3>
        </div>
      </div>

      <div className="px-3 py-2">
        <span className="truncate text-xs text-black/60">{show.nextVenue}</span>
      </div>
    </Link>
  );
}
