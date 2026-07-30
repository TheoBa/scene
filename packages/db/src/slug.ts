// URL slug from a show name: strip accents, lowercase, non-alphanumerics → "-".
// Shared by the seed and the ingestion resolve step so both key events on the
// SAME slug — `events.slug` is the unique key the resolve step upserts against,
// so any drift here would create duplicate productions.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
