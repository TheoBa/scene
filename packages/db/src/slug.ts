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

// Slug + numeric-suffix collision resolution: given a base slug and the set of
// slugs already taken, returns a slug guaranteed not to collide \u2014 `base`, then
// `base-2`, `base-3`, etc. Needed for venues/artists (unlike `events`, where two
// show titles colliding once slugified is rare enough to have been left
// unhandled): venue/artist names collide far more often once accents and
// punctuation are stripped (e.g. two "Th\u00e9\u00e2tre du Nord"-ish names).
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
