---
note_ids: []
status: implemented_pending_review
created: 2026-08-02
pr: https://github.com/TheoBa/scene/pull/47
---

# One-off backfill: artist photos + social links

## Source
No dev note — requested directly in conversation (2026-08-02), as the second
half of the ingestion-coverage work started with venue lat/lng
(`docs/plans/2026-08-01-venue-directions-map.md`, implemented in #46). Artist
photos/social links were explicitly deferred there ("we'll deal with Artist
photos next").

## Problem
`artists` (`packages/db/src/schema.ts:111-125`) is auto-populated by the
worker's enrich step (`apps/worker/src/enrich.ts`) purely from Ticketmaster's
`performers[]` names — just `name`/`slug`. `imageUrl` and `officialUrl`
columns exist on the table already but nothing fills them, and there's no
social-link storage at all. The artist page
(`apps/web/app/artiste/[slug]/page.tsx:57-66`) renders a photo (falling back
to a placeholder via `posterSrc`) and an "Site officiel ↗" link when present —
so most artist pages today show a generic placeholder and no links.

## Proposed approach

### 1. Data source: Wikidata
No source we ingest today (Ticketmaster, OpenAgenda, DATAtourisme, France
Billet) supplies artist photos or social handles — this has to be a separate
lookup, keyed on `artists.name`. Wikidata is the best fit: free, no API key,
no meaningful rate cap for this volume, and it carries exactly the fields we
need as structured properties:

- **P18** (image) → a Wikimedia Commons filename, turned into a direct URL via
  `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>`
- **P2013** (Facebook ID), **P2003** (Instagram username), **P2002**
  (Twitter/X username) → build profile URLs from the raw handles
- **P856** (official website) → only used to fill `officialUrl` if still null

Lookup: Wikidata's `wbsearchentities` API
(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<name>&language=fr&format=json`)
for candidate entity IDs, then `wbgetentities` (or the search response's
`description` field) to fetch claims for each candidate.

**Match-quality guard (the main risk here):** name search alone will produce
false positives — common names, unrelated people/companies with the same
label. Before accepting a match, require:
- The candidate's label matches the artist name exactly (case-insensitive),
  not just a fuzzy search hit.
- The entity's occupation (P106) or instance-of (P31) indicates a relevant
  type — actor (Q33999), theatre director (Q3387717), playwright (Q214917),
  dancer, or a performing-arts group/company. Reject anything else.
- Exactly one candidate survives both filters. If zero or more than one do,
  skip the artist and log it as unmatched/ambiguous rather than guessing.

This means coverage will be partial — only artists/companies notable enough
to have a Wikidata entry, correctly filtered by occupation. That's the right
trade for a photo-attribution feature: wrong data (someone else's face on an
artist's page) is worse than missing data.

### 2. Schema: social link columns on `artists`
`packages/db/src/schema.ts`'s `artists` table gains three nullable columns,
alongside the existing `imageUrl`/`officialUrl`:
```ts
instagramUrl: text("instagram_url"),
facebookUrl: text("facebook_url"),
twitterUrl: text("twitter_url"),
```
Nullable from the start (same reasoning as `venues.lat`/`lng` — populated rows
already exist). No backfill-then-tighten step needed since these will likely
never be `NOT NULL` (most artists won't have all three, or any).
Generate + apply via `npm run db:generate` / `npm run db:migrate`
(staging migration is a manual step Théo runs per
`docs/deployment-runbook.md` §S5).

### 3. Backfill script
`packages/db/seed/backfill-artist-enrichment.ts`, same shape as
`backfill-venue-lats-lngs.ts`:
- Select artists where `imageUrl IS NULL OR instagramUrl IS NULL OR
  facebookUrl IS NULL OR twitterUrl IS NULL OR officialUrl IS NULL` — i.e. any
  artist still missing at least one enrichable field, so re-running later
  (after a name gets a Wikidata entry, or a rejected earlier match) picks it
  up again.
- For each: search Wikidata, apply the match-quality guard above, and only
  set columns that are currently null (never overwrite a curated value —
  matches the "never clobber curated data" rule already used in
  `enrich.ts:36-37`).
- Delay between requests (~200ms) and a descriptive `User-Agent` header per
  Wikidata's API etiquette (no hard published cap at this volume, but polite
  pacing costs nothing).
- Log a summary: N enriched, M skipped (no candidate), K skipped (ambiguous
  match) — the ambiguous count is worth watching if it's high, it means the
  occupation filter needs tightening.
- Script name: `npm run backfill-artist-enrichment -w packages/db`.

### 4. Rendering on the artist page
`apps/web/app/artiste/[slug]/page.tsx`:
- `imageUrl` already renders (`posterSrc(artist.imageUrl)` at line ~57) — no
  change needed there, it'll just stop showing the placeholder once backfilled.
- Add a small row of social icon links next to the existing "Site officiel ↗"
  button (~line 80-90), each rendered only when its URL is non-null. `apps/web`
  already depends on `lucide-react` (no new package needed) — use its
  `Instagram`/`Facebook`/`Twitter` icons inside the same pill styling
  (`rounded-full bg-black/5 px-4 py-2 ...`) as the existing "Site officiel ↗"
  link, icon-only (no `next/dynamic` needed, these are plain SVG components).
- `apps/web/lib/artists.ts`'s `ArtistDetail` interface and
  `getArtistBySlug`/`listArtists` selects gain the three new fields, same
  pattern as `VenueDetail`'s `lat`/`lng` addition in #46.

## Out of scope
- Instagram/Facebook Graph API integration (OAuth, app review) — reading
  public profile URLs from Wikidata is enough; no live follower counts/feeds.
- Ongoing enrichment hooked into ingestion (like venue geocoding could later
  be) — this is on-demand only, re-run manually when useful (e.g. after a
  batch of new artists is ingested).
- Backfilling companies/artists with no Wikidata presence — no fallback
  scraping source is in scope.
- Editing social links via the claimed-artist self-edit form
  (`ClaimedEntityEditForm`) — claimed artists can already self-edit
  bio/photo/official link; whether to extend that form to the three new
  fields is a separate, small follow-up, not required for this backfill to
  ship.

## Decisions
- **Social link UI:** icons, not text pills — using `lucide-react` (already a
  dependency, no new package).
- **Match-quality process:** run the backfill against all artists in one pass
  (no separate dry-run mode), then manually spot-check ~10-15 matched results
  against the logged summary before trusting it unattended.

## Open questions / risks
- **Match-quality guard is the crux of this plan** — the spot-check above is
  the safety net; if it turns up a wrong match, tighten the occupation filter
  before re-running rather than trusting the rest of the batch.
- Coverage will likely be low for small/local French théâtre compagnies that
  don't have Wikidata entries — worth setting that expectation before running
  it, so a low "N enriched" count isn't read as a bug.
