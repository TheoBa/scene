"use server";

import { getPopularShows, type ShowCard } from "@/lib/catalogue";
import { getVenuesNear, type VenueCard } from "@/lib/venues";

// Re-fetches the two geolocation-aware carousels once the viewer has shared
// (or the client already has) their coordinates. Kept as a single round-trip
// so the "Voir près de chez vous" button only needs one server call.
export async function getNearMeCarousels(
  lat: number,
  lng: number,
): Promise<{ popularShows: ShowCard[]; venues: VenueCard[] }> {
  const near = { lat, lng };
  const [popularShows, venues] = await Promise.all([
    getPopularShows(near),
    getVenuesNear(near),
  ]);
  return { popularShows, venues };
}
