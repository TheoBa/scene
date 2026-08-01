// Single seam for resolving a show's poster image `src`. Order of preference:
//   1. the show's own committed poster (events.imageUrl — a filename under
//      /public/posters, an "uploads/<file>" ref to an admin-uploaded poster,
//      or an absolute URL),
//   2. (later) the lead artist's picture — slots in here once artists land,
//   3. a general fallback poster, so a show with no artwork still renders cleanly
//      instead of being hidden or showing a blank tile.
// Keeping this in one place means the future artist-image step is a change here,
// not across every surface that shows a poster.

export const POSTER_FALLBACK = "/poster-default.svg";

export function posterSrc(imageUrl: string | null | undefined): string {
  if (!imageUrl) return POSTER_FALLBACK;
  // Absolute URLs (future external / artist images) pass through as-is.
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  // Otherwise it's either a filename committed under /public/posters, or (for
  // admin-uploaded posters) "uploads/<file>" — both resolve under /posters/,
  // the former served statically, the latter by
  // app/posters/uploads/[filename]/route.ts from a persistent volume (since
  // /public is baked into the Docker image and wiped on every redeploy).
  return `/posters/${imageUrl}`;
}
