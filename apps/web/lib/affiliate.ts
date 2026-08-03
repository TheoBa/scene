// Amazon Associates affiliate links.
//
// We link to an amazon.fr *search* results page for "<title> <author>"
// rather than a specific ISBN/edition — most shows don't have a single
// canonical published edition, and a search page degrades gracefully when
// no exact match exists. Requires an Amazon.fr Associates tag; see
// AMAZON_ASSOCIATE_TAG in .env.example.

const AMAZON_ASSOCIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG;

export const amazonAffiliateEnabled = Boolean(AMAZON_ASSOCIATE_TAG);

// Builds an amazon.fr search URL tagged with our Associates ID, or null when
// no tag is configured (callers should hide the link entirely in that case —
// an untagged link earns no commission and shouldn't be shown as if it does).
export function buildAmazonSearchUrl(
  title: string,
  author?: string | null,
): string | null {
  if (!AMAZON_ASSOCIATE_TAG) return null;

  const query = [title, author].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    k: query,
    tag: AMAZON_ASSOCIATE_TAG,
  });
  return `https://www.amazon.fr/s?${params.toString()}`;
}
