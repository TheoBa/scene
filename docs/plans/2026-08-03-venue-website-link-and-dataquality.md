---
note_ids: []
status: implemented_pending_review
created: 2026-08-03
pr: https://github.com/TheoBa/scene/pull/50
---

# Venue website link (ingested data) + data-quality panel: split sections, track links/coords

## Source
No dev note — requested directly in conversation (2026-08-03), right after
merging/staging the venue photo+bio backfill (#49).

## Finding that reshapes part 1: there's no venue-website field to ingest
Checked every ingestion source before proposing anything:
- **Ticketmaster** (`apps/worker/src/sources/ticketmaster.ts`) is the only
  *implemented* source. Its venue object (verified against a real staging row)
  has no "official website" field — only a `url` pointing at a
  **ticketmaster.fr listing page** (e.g.
  `ticketmaster.fr/fr/salle/essaion-de-paris/idsite/596`), which is not the
  venue's own site. Writing that into `officialUrl` would be actively
  misleading (and would permanently block the correct site, since the
  Wikidata backfill only ever fills a still-null `officialUrl`).
- **OpenAgenda**, **DATAtourisme**, **France Billet** — all three are `TODO`
  stubs (`apps/worker/src/sources/{openagenda,datatourisme,francebillet}.ts`),
  not wired to anything yet.

So there is genuinely no ingested-data source for venue websites today. The
mechanism that already does this job is the Wikidata backfill shipped in #49
(`packages/db/seed/backfill-venue-enrichment.ts`) — 12/139 staging venues
enriched with a real `officialUrl` already. Recommendation: don't add a fake
ingestion-side link; keep relying on (and periodically re-running) that
backfill as new venues get ingested.

**"Add it on their page"** — already shipped, nothing to do: `officialUrl`
is selected in `apps/web/lib/venues.ts:77` and rendered as the "Site officiel
↗" button on `apps/web/app/salle/[slug]/page.tsx` (~line 97).

### Related, unprompted finding worth flagging
`events.officialUrl` (a *different* column, on `events` not `venues`) is
tracked in `/dev/data-quality`'s coverage bars but **nothing has ever written
it** — same gap, stuck at 0% coverage. Not touched by this plan (out of
scope, and it's an events-table gap, not venues), flagging so it's not
mistaken for something this plan fixes.

## Bonus option surfaced while checking Ticketmaster's payload
The same real venue object that lacks a website *does* carry real
coordinates directly:
```json
"location": { "latitude": "48.859736", "longitude": "2.353091" }
```
Right now `venues.lat`/`lng` only ever get filled by
`backfill-venue-lats-lngs.ts` (geocoding `address` via the BAN API), a manual
one-off run. Since this plan is about to add a "lat/long coverage" bar to
`/dev/data-quality`, it's worth deciding now whether to also have
`resolve.ts`'s venue upsert grab TM's own `location.latitude/longitude`
directly when creating a venue — free, exact coordinates, zero extra API
calls, for every future Ticketmaster-sourced venue, instead of leaving them
to a manual backfill run. This is beyond the literal ask, called out as an
option rather than assumed.

## Proposed approach

### 1. `/dev/data-quality`: split venue/artist sections, add tracked fields
`apps/web/app/dev/data-quality/page.tsx`'s "Pages salle / artiste" card
currently crams both under one heading as two grid columns. Split into two
independent `<section>` blocks (own card, own `<h2>`), each gaining a "Lien
officiel" bar:
- **Salles**: Bio, Photo, **Lien officiel** (new), **Coordonnées (lat/long)**
  (new), Revendiquées.
- **Artistes**: Bio, Photo, **Lien officiel** (new), Revendiqués, Liés à un
  spectacle.

`apps/worker/src/metrics.ts`'s `computeMetrics()` gains the matching columns:
- `venues.officialUrl` → `count(venues.officialUrl)`
- `venues.lat` → `count(venues.lat)` (lat/lng are always written together by
  both backfill scripts, so counting one column is an accurate proxy — same
  convention as every other single-column `Coverage` here)
- `artists.officialUrl` → `count(artists.officialUrl)`

`MetricsSnapshot`'s `venues`/`artists` types gain `officialUrl: Coverage` (and
`venues` gains `lat: Coverage`). `logMetrics()`'s log lines get the two new
fields appended, same style as the existing ones.

### 2. (if wanted) Ticketmaster-sourced lat/lng at ingestion time
`resolve.ts`'s venue upsert (~line 112) reads `location.latitude/longitude`
off the raw TM venue payload (already captured in `sourceEvents.raw`, just
not extracted into typed columns yet) and sets `lat`/`lng` on insert — only
on **insert** (new venue), never overwriting an existing venue's
already-set/curated coordinates, same never-clobber rule as everywhere else
in this pipeline. `backfill-venue-lats-lngs.ts` keeps existing as the
catch-up path for venues that predate this (or came from a non-coordinate
source).

## Out of scope
- Fixing `events.officialUrl`'s 0%-coverage gap (flagged above, separate
  problem).
- Implementing OpenAgenda/DATAtourisme/France Billet — unrelated, larger
  pieces of work already tracked elsewhere.
- Any new schema/migration — every column this plan touches already exists.

## Decisions
- **Include both**: ship the data-quality dashboard split/new fields AND have
  `resolve.ts` pull Ticketmaster's own `location.latitude/longitude` for
  newly-created venues in the same pass.
