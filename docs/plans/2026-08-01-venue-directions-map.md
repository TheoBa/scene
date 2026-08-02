---
note_ids: [bc143166-2ade-4688-af06-5a65812f8e69]
status: plan_done
created: 2026-08-01
---

# Embedded "get there" map card on the venue page

## Source notes
> Adresse display sur un encart maps en mode "vous y rendre" — idea, dropped from /shows

## Problem / request
Théo wants an address shown inside an actual embedded map card, in a "get
there"/directions mode — confirmed (over the simpler link-out alternative)
during triage: **embedded interactive map**, not just an "Open in Maps" link.

The note was dropped from `/shows`, but the show page
(`apps/web/app/shows/[slug]/page.tsx`) only ever shows a venue's *name*, linked
to `/salle/[slug]`. The venue page (`apps/web/app/salle/[slug]/page.tsx:83`)
already renders `venue.address` as plain text and is the natural single home
for a per-venue map — a show can have performances across several different
venues, so a map embed belongs on the venue page, not repeated per performance
row on the show page.

## Proposed approach

### 1. Schema: add coordinates to `venues`
`packages/db/src/schema.ts`'s `venues` table (`packages/db/schema.ts:24-46`) has
only free-text `address`, no `lat`/`lng`. Add nullable columns:
```ts
lat: doublePrecision("lat"),
lng: doublePrecision("lng"),
```
Nullable, matching the existing pattern noted in the schema comments for
`venues.slug` — populated venues rows already exist in every environment, so
this must land nullable and get backfilled, same two-PR split
(`docs/deployment-runbook.md` §S5) if a later `NOT NULL` pass is ever wanted.
Generate + apply via `npm run db:generate` / `npm run db:migrate`
(`docs/deployment-runbook.md` §S5 — staging migrations are a manual step Théo
runs on the Mac Mini, not automatic on deploy).

### 2. Geocoding: backfill script
`docs/technical-roadmap.md` Phase 1 already commits to "Venue geocoding — reuse
the approach from V0's `geocode-theatres.ts`" for the broader catalogue effort;
this note is effectively pulling a slice of that forward. Add
`packages/db/seed/backfill-venue-lats-lngs.ts` (mirrors the existing
`backfill-venue-slugs.ts` convention already in that folder): iterate venues
with a non-null `address` and null `lat`/`lng`, geocode via a free provider
(e.g. Nominatim/OpenStreetMap — no API key, rate-limited to 1 req/s per their
usage policy) and write back `lat`/`lng`. New venues from ingestion should be
geocoded going forward too — hook into the same ingestion path that already
resolves venues (`apps/worker`), or re-run the backfill script periodically
until that's wired in.

### 3. Map rendering on the venue page
No map library is in this repo yet (`package.json` has no leaflet/mapbox/etc).
Add **Leaflet** + **react-leaflet** with OpenStreetMap tiles (free, no API key
— the roadmap's Phase 2 "Map view" item already plans to "port Leaflet work
from V0", so this reuses the same stack rather than introducing a second one).

- New client component `apps/web/components/VenueMap.tsx`: given `lat`/`lng`,
  renders a small Leaflet map (single marker, non-interactive-ish — zoom/pan
  fine, no controls needed for a single-venue card) inside a rounded card
  matching the existing card style (`rounded-2xl bg-white shadow-sm ring-1
  ring-black/5`, same as the claim-form section).
- Render it in `apps/web/app/salle/[slug]/page.tsx`, directly below the
  address line (~line 83), only when `venue.lat`/`venue.lng` are non-null —
  venues not yet geocoded just keep showing the plain address text as today
  (graceful degradation, not an error state).
- Card includes a plain "Ouvrir dans Maps" link
  (`https://maps.google.com/?q=${lat},${lng}`) alongside the embed, since an
  embedded map alone isn't turn-by-turn — cheap to add, directly serves the
  "vous y rendre" (get there) framing from the note.

## Out of scope
- The Phase 2 catalogue-wide map view (listing/search map) — this plan is
  scoped to the single-venue directions card only.
- Turn-by-turn navigation inside the app.
- Geocoding accuracy QA / manual correction UI — if Nominatim mis-resolves an
  address, that's a data-quality follow-up, not part of this plan.

## Open questions / risks
- **Nominatim's usage policy caps free requests at 1/s and asks for a
  descriptive User-Agent** — fine for a one-off backfill of ~200 venues, but
  don't call it from a user-facing request path.
- V0's exact `geocode-theatres.ts` approach isn't available in this repo to
  compare against (it lives in the separate `scenes_V0` project, not present on
  this machine) — confirm with Théo whether that script is grab-and-adapt or
  whether Nominatim-from-scratch is fine.
- This is meaningfully bigger than the note implied (new migration + new
  dependency + backfill script + new component), a direct consequence of
  choosing the embedded-map option over the simpler link-out — worth a sanity
  check with Théo before starting if the scope surprises him.
