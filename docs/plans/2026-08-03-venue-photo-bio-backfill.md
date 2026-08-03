---
note_ids: []
status: implemented_pending_review
created: 2026-08-03
pr: https://github.com/TheoBa/scene/pull/49
---

# One-off backfill: venue photos + bios

## Source
No dev note — requested directly in conversation (2026-08-03), as a direct
follow-up to the artist enrichment work
(`docs/plans/2026-08-02-artist-photo-social-backfill.md`, implemented in #47,
staged and merged as the `staging-db-enrichment` skill in #48), which that
skill's own description already anticipated ("we will enhance this skill with
querying venue related information").

## Problem
`venues` (`packages/db/src/schema.ts:25-54`) already has `bio`, `imageUrl`,
and `officialUrl` columns — added alongside `lat`/`lng` for the directions-map
work (#46) but never filled by anything. Ingestion (OpenAgenda, DATAtourisme,
France Billet, Ticketmaster) only ever supplies a venue `name`/`address`; none
of it carries a photo or description. The venue page
(`apps/web/app/salle/[slug]/page.tsx`) and `apps/web/lib/venues.ts`'s
`VenueDetail` **already select and render all three fields** — `imageUrl` in
the hero image (via `posterSrc`), `bio` in the claimed-venue edit form's
initial value — so unlike the artist work, this needs **no schema change and
no frontend change**. It's purely a backfill script, same shape as
`backfill-venue-lats-lngs.ts` and `backfill-artist-enrichment.ts`.

## Proposed approach

### Data source: Wikidata (+ Wikipedia for bio text)
Same choice as the artist backfill and for the same reason — free, no API
key, no meaningful rate cap, keyed on `venues.name`:
- **P18** (image) → Commons file → `Special:FilePath/<filename>` URL, same as
  artists.
- **P856** (official website) → fills `officialUrl` if still null.
- **Bio text**: Wikidata's own `description` field is a short clause ("salle
  de théâtre à Paris"), not real prose. Better source: the entity's French
  Wikipedia sitelink, fetched through Wikipedia's REST summary endpoint
  (`https://fr.wikipedia.org/api/rest_v1/page/summary/<title>`), which returns
  a proper lead paragraph (`extract` field) — much closer to what `bio` is for
  (schema.ts calls it "free-text description; self-editable once claimed").
  Falls back to the Wikidata description if no French Wikipedia sitelink
  exists.

**Match-quality guard**, same "skip rather than guess" philosophy as artists,
adjusted for venues:
- Exact label match (case-insensitive) against `venues.name`.
- Instance-of (P31) in an allow-list of venue-type QIDs: theatre building
  (Q24354), opera house (Q1370598), concert hall (Q1329623), performing arts
  venue types more broadly (cultural centre, auditorium).
- **Country filter**: require P17 (country) = France (Q142), or accept if P17
  is simply absent (small local venues often have no country claim at all)
  rather than reject — but never accept a claimed foreign country. This
  matters more for venues than artists: names like "Théâtre National" or
  "Opéra" are generic enough to collide with venues abroad.
- Exactly one candidate survives all filters, else skip and log
  (unmatched/ambiguous), same as artists.

### Backfill script
`packages/db/seed/backfill-venue-enrichment.ts`:
- Select venues where `imageUrl IS NULL OR bio IS NULL OR officialUrl IS
  NULL` — re-runnable, only ever touches still-missing fields.
- Same never-clobber rule: only set a column if it's currently null.
- ~200ms delay + descriptive `User-Agent`, same etiquette as the artist
  script.
- Summary log: N enriched, M unmatched, K ambiguous (of total candidates).
- `npm run backfill-venue-enrichment -w packages/db`, added to
  `packages/db/package.json`.

### Rollout
No migration to write or apply. Run locally first, spot-check, then invoke
via the `staging-db-enrichment` skill (already generalized for "a named
backfill script") — no skill changes needed either, beyond it picking up the
new script name.

## Out of scope
- Venue social links (Instagram/Facebook/X) — not requested here; would need
  new columns (`venues` has none today), unlike artists which already had
  placeholders for this. A separate follow-up if wanted later.
- Any venue-related **read-only query** enhancements to the
  `staging-db-enrichment` skill (e.g. coverage dashboards) — that skill
  already supports ad-hoc queries generically; nothing further to build.
- Non-French venues, or venues without any Wikidata presence — same coverage
  ceiling as the artist backfill.

## Decisions
- **Bio source**: Wikipedia extract, truncated to ~300 characters (cut at the
  last full sentence, or word, within budget) — falls back to the Wikidata
  short description when there's no French Wikipedia sitelink.
