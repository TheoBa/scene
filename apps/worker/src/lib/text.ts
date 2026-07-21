import { createHash } from "node:crypto";

/** Lowercase, strip accents/diacritics, drop punctuation, collapse whitespace.
 *  Used both for slugs and for matching titles across sources / the audit. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** URL-safe slug: normalized text with words joined by hyphens. */
export function slugify(input: string): string {
  return normalizeText(input).replace(/ /g, "-");
}

/** Short deterministic suffix so two pieces with the same title still get
 *  distinct slugs. Keyed on the source ref, so re-ingesting is idempotent. */
export function shortHash(input: string, length = 6): string {
  return createHash("sha1").update(input).digest("hex").slice(0, length);
}

/**
 * OpenAgenda multilingual fields are objects keyed by language ({ fr: "…" }).
 * With `monolingual=fr` the API returns a plain string instead — handle both,
 * and fall back to the first available language.
 */
export function pickLang(
  value: string | Record<string, string> | null | undefined,
  lang = "fr",
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  return value[lang] ?? Object.values(value)[0];
}
