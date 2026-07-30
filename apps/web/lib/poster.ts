// Single seam for resolving a show's poster image `src`. Order of preference:
//   1. the show's own committed poster (events.imageUrl — a filename under
//      /public/posters, or an absolute URL),
//   2. (later) the lead artist's picture — slots in here once artists land,
//   3. a general fallback poster, so a show with no artwork still renders cleanly
//      instead of being hidden or showing a blank tile.
// Keeping this in one place means the future artist-image step is a change here,
// not across every surface that shows a poster.

export const POSTER_FALLBACK = "/poster-default.svg";

export function posterSrc(imageUrl: string | null | undefined): string {
  if (!imageUrl) return POSTER_FALLBACK;
  // Absolute URLs (future external / artist images) pass through as-is;
  // otherwise it's a filename committed under /public/posters.
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  return `/posters/${imageUrl}`;
}
