"use client";

import { useState, useTransition } from "react";
import { Carousel, CarouselItem } from "@/components/Carousel";
import type { ShowCard } from "@/lib/catalogue";
import type { VenueCard } from "@/lib/venues";
import { getNearMeCarousels } from "./near-actions";
import { ShowPosterCard } from "./ShowPosterCard";
import { VenueCardTile } from "./VenueCardTile";

// "Populaire près de chez vous" + "Salles près de chez vous", gated behind an
// explicit button rather than prompting for geolocation on load — an
// unprompted browser permission dialog on first visit is a bad first
// impression (see plan's open question). Denied/unavailable geolocation keeps
// the citywide fallback data the server already rendered.
export function NearMeCarousels({
  initialPopularShows,
  initialVenues,
}: {
  initialPopularShows: ShowCard[];
  initialVenues: VenueCard[];
}) {
  const [popularShows, setPopularShows] = useState(initialPopularShows);
  const [venues, setVenues] = useState(initialVenues);
  const [state, setState] = useState<"idle" | "denied" | "done">("idle");
  const [isPending, startTransition] = useTransition();

  function handleLocate() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        startTransition(async () => {
          const fresh = await getNearMeCarousels(latitude, longitude);
          setPopularShows(fresh.popularShows);
          setVenues(fresh.venues);
          setState("done");
        });
      },
      () => setState("denied"),
      { timeout: 8000 },
    );
  }

  const locateButton =
    state === "idle" ? (
      <button
        type="button"
        onClick={handleLocate}
        disabled={isPending}
        className="shrink-0 rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium text-black/70 transition hover:border-black/30 disabled:opacity-60"
      >
        {isPending ? "Localisation…" : "Voir près de chez vous"}
      </button>
    ) : state === "denied" ? (
      <span className="shrink-0 text-sm text-black/40">Popularité à Paris</span>
    ) : null;

  return (
    <>
      <Carousel
        title="Populaire près de chez vous"
        subtitle="Les spectacles les plus appréciés en ce moment."
        action={locateButton}
      >
        {popularShows.map((s) => (
          <CarouselItem key={s.slug}>
            <ShowPosterCard show={s} />
          </CarouselItem>
        ))}
      </Carousel>

      <Carousel title="Salles près de chez vous" subtitle="Les théâtres à découvrir.">
        {venues.map((v) => (
          <CarouselItem key={v.slug}>
            <VenueCardTile venue={v} />
          </CarouselItem>
        ))}
      </Carousel>
    </>
  );
}
