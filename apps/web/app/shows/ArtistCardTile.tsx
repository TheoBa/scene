import Link from "next/link";
import { posterSrc } from "@/lib/poster";
import type { ArtistCard } from "@/lib/artists";

// Compact artist tile for "Artistes qui pourraient te plaire" — mirrors
// /artiste's square card, narrowed for a fixed-width snap point.
export function ArtistCardTile({ artist }: { artist: ArtistCard }) {
  return (
    <Link
      href={`/artiste/${artist.slug}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
    >
      <div className="relative aspect-square overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterSrc(artist.imageUrl)}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold">{artist.name}</h3>
      </div>
    </Link>
  );
}
