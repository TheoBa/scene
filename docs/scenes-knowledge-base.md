# Scenes — Project Knowledge Base

> Living document. Last updated: 2026-07-18. Owner: Théo (CTO).
> Purpose: single source of truth for the Scenes concept, decisions, and open questions. Enhanced iteratively.
> Canonical copy lives in the repo: `scenes_project/scenes_V1/docs/`. Keep both in sync.
> Companion docs in the repo: `technical-roadmap.md` (phased plan), `deployment-runbook.md` (self-hosting), `frontend-feature-inventory.md` (V0 audit).

---

## 1. One-line pitch

A social media platform built around French culture, starting with live theatre — a designed, community-driven knowledge base of every show playing in Paris, where people discover, rate, comment, and share pieces, and follow friends and influencers for recommendations.

## 2. Vision & scope

Build the reference destination for live theatre in Paris: a comprehensive, always-current knowledge base of shows currently playing, wrapped in a social discovery experience. Expand city by city (other French cities first), and potentially broaden from theatre to other live-culture verticals over time.

**Initial focus:** theatre pieces playing in Paris venues.
**Expansion path:** other French cities → (possibly) other cultural verticals.

## 3. Users & roles

**Standard user (audience)**
- Browses a well-designed site to find, rate, and comment on theatre pieces.
- Follows friends and influencers for recommendations.
- Uses an Explorer tab for taste-based discovery of new shows.
- Opens a piece to get additional information and a redirect link to a ticketing partner.

**Venues**
- Dedicated access to build and manage their own pages.
- Centralize all their pieces in one place.

**Artists**
- Own pages tied to the pieces they perform in.

## 4. Core product surfaces (MVP thinking)

- **Feed / social layer** — activity from followed friends and influencers; ratings, comments, shares.
- **Piece page** — canonical entry per show: info, cast, venue, ratings, comments, ticketing redirect link.
- **Explorer / discovery tab** — recommendations based on the user's taste.
- **Venue pages** — venue-managed, aggregating their programme.
- **Artist pages** — profile per artist, linked to their pieces.
- **Search** — find a piece, venue, or artist.

## 5. Business model

**Revenue stream 1 — Ticketing affiliation (launch):** commission on referrals via redirect links to ticketing partners.
**Revenue stream 2 — Venue subscriptions (later):** paid access/tools for venues once the platform has enough reach and audience to justify it.

Both streams depend on building the audience-side network first (classic marketplace cold-start: get users → attract venues/artists → monetize).

## 6. Data model (early sketch)

Core entities and how they relate:

- **Piece** — a show. Belongs to one or more Venues; has many Artists; accumulates Ratings & Comments; links to Ticketing offers.
- **Venue** — a place. Has many Pieces; venue-managed page.
- **Artist** — a performer. Appears in many Pieces; own page.
- **User** — audience member. Follows Users/Influencers; creates Ratings, Comments, follows.
- **Ticketing offer** — external link + affiliate tracking, attached to a Piece.

V0 implemented (Supabase): `scenes` (pieces), `salles` (venues, geocoded), `profiles` (incl. artist mode), `notebooks`/`notebook_items`/`notebook_members` (carnets), `friendships`, `invitations`, `activity_feed`, `scenes_proposees`.

**Current V1 POC schema (2026-07-21).** For the POC we start lean — three logical domains in one Postgres `public` schema, columns kept minimal and added only when a feature needs them:

- `venues` — `id`, `name` (unique), `address`
- `events` — `id`, `name` (the central "show"/production entity, **renamed from *piece***; holds no venue or date)
- `performances` — `id`, `event_id → events.id`, `venue_id → venues.id`, `starts_at` (one row per individual showing, so a run of many nights — or a show touring several venues — is modelled correctly; `starts_at` is a full timestamp and carries the showtime)
- `users` — `id`, `pseudo` (unique)

Ratings/comments, ticketing, geocoding (`lat`/`lng`) and provenance (`source`/`source_ref`) columns are deferred until the features that need them. Data is filled manually via a versioned seed script (`npm run db:seed`) and, for Ticketmaster, an ingestion worker.

**Artists (added 2026-07-30):** `artists` (`id`, `name` unique, `slug` unique, `bio`, `image_url`, `official_url`, `claimed_by_user_id`, `claimed_at`) plus `event_artists` (many-to-many event↔artist link). No person/company distinction — a director credit and a compagnie name are both plain `artists` rows, mirroring how `events.director` already conflates the two. Auto-populated from the seed's `author`/`director` fields and from Ticketmaster's `performers[]` (the only source that currently supplies it). `venues` gained the same `slug`/`bio`/`image_url`/`official_url`/`claimed_by_user_id`/`claimed_at` shape, making venue and artist pages symmetric.

## 7. Data sourcing & legal strategy

**Legal context (researched 2026-07):** daily scraping of billetreduc.fr is high-risk in France — sui generis database right (repeated systematic extraction sanctioned; Cour de cassation confirmed Oct 2025), CGU breach + parasitisme, and GDPR/CNIL exposure on personal data (KASPR fined €240k). Scraping is MVP-only; must be retired before scale. Note: billetreduc is owned by Fnac Darty — same group as France Billet / Fnac Spectacles.

**Target three-layer sourcing architecture:**

1. **Open data (breadth, free, legal):**
   - OpenAgenda — read/write API, schema.org, open licence.
   - DATAtourisme — national platform, API (api.datatourisme.fr), Licence Ouverte 2.0, daily updates, cultural-events category.
   - Que Faire à Paris? — Paris open-data events API (Paris-first launch).
2. **Affiliate feeds (bookable inventory + revenue):**
   - France Billet / Fnac Spectacles via Awin — daily XML feed, filterable by location/type/artist/venue; 60k+ events/yr. Official route to billetreduc-group inventory. **Priority.**
   - Ticketmaster Discovery API — free key, France supported, theatre category, affiliate tracking auto-injected in event URLs (Impact).
   - See Tickets France (sold by Vivendi to Fever) / Fever affiliate — powers major Paris houses (e.g. Odéon).
3. **Venue self-serve (first-party):** venues manage their own pages/programmes — zero legal risk, becomes primary source as the network grows.

Action: get a French IP/IT lawyer review before scaling any automated collection.

## 8. Existing prototype — scenes_V0

Vibe-coded first iteration by CEO (mostly frontend + tiny backend from manual scraping). Located at `scenes_project/scenes_V0/`.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase (auth, DB, edge functions), Leaflet maps, PWA (next-pwa), Resend (emails). Designed for Vercel deploy.
- **Feature inventory:** see `docs/frontend-feature-inventory.md` in the repo.
- **Status:** reference implementation for product/UX ideas. V1 restarts from scratch in `scenes_project/scenes_V1/`; infra choices (Supabase/Vercel replacements) deliberately deferred.

## 9. Key differentiators / bets

- A genuinely well-designed, culture-first social experience (vs. generic listing/ticketing sites).
- Community + influencer recommendations as the discovery engine.
- Comprehensive, live knowledge base as the moat (hard to replicate once complete and current).

## 10. Open questions & risks

**Product / data**
- Which sources cover the "every piece in Paris" goal with daily freshness? (validate coverage of open data + affiliate feeds vs. billetreduc catalogue)
- Entity resolution: dedup pieces/venues/artists across multiple feeds.
- Cold-start for the Explorer tab recommendations.

**Business**
- Confirm affiliate commissions/terms: France Billet (Awin), Ticketmaster, Fever.
- Wedge to get the first cohort of users.

**Market**
- Incumbent mapping (listing sites, ticketing platforms, critics' sites) — where is the gap?
- Is theatre big enough, or a beachhead into broader live culture?

**Team / role**
- CTO role terms: build vs. lead, equity, time commitment.

## 11. Tech considerations

**V1 stack (decided 2026-07-18, self-host-first):**

- Hosting: Coolify (self-hosted PaaS). **Staging now:** personal Mac Mini (Apple Silicon) → Ubuntu 24.04 arm64 VM → Coolify, exposed via Cloudflare Tunnel on `scenes.badoz.org` (€0, no port forwarding, TLS at Cloudflare edge). **Production later:** Hetzner CX32 + brand domain, before public launch.
- Architecture: monorepo (npm workspaces) — `apps/web` (Next.js, App Router, `output: standalone`, Dockerized) + `apps/worker` (Node/TS, daily ingestion jobs) + `packages/db` (shared Drizzle schema on Postgres).
- Database: self-hosted Postgres (Docker).
- Auth: better-auth (in-app, sessions in Postgres).
- Email: Resend (kept managed — deliverability from a VPS is not worth self-hosting).
- Object storage: MinIO later if needed.
- Rationale: monolith speed + SSR/SEO (programmatic SEO on piece/venue pages = key acquisition channel); ingestion isolated in worker; dedicated API extracted only when a second client (mobile, venue portal) exists — shared db package makes that cheap.
- Recommendation engine: TBD (heuristics/collaborative filtering to start).
- Affiliate tracking: link decoration per partner (Awin/Impact).

## 12. Competitive & market landscape (to research)

*Placeholder — to populate with French theatre listing sites, ticketing platforms, critics/review sites, and any existing social-discovery products.*

## 13. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-18 | Restart V1 from scratch in `scenes_project/scenes_V1/` | V0 is a vibe-coded prototype; avoid Supabase/Vercel lock-in — infra choices deferred |
| 2026-07-18 | Retire billetreduc scraping; move to open data + affiliate feeds + venue self-serve | Legal risk (sui generis DB right, parasitisme, GDPR) + affiliate feeds align data with revenue |
| 2026-07-18 | V1 stack: Coolify, Next.js monolith + worker + shared Drizzle/Postgres, better-auth, Resend | Self-host-first; SSR/SEO critical; ingestion outside web framework; defer dedicated API until second client exists |
| 2026-07-18 | Phase 0 runs on the personal Mac Mini via Cloudflare Tunnel on `scenes.badoz.org`; Hetzner deferred to pre-launch | Free validation of the identical Coolify path; Mac Mini remains staging afterwards. Personal domain = staging only, never the public launch domain (SEO/brand equity) |
| 2026-07-21 | Do **not** migrate any V0/Supabase data into V1; start the database empty and let ingestion build the catalogue | V0 was a POC with no real user data; its catalogue was billetreduc-scraped (the source being retired) with no provenance and a mismatched schema. The old catalogue is kept only as an offline reference list for the Phase 1 coverage audit. Decommission Supabase as a separate cleanup. |
| 2026-07-21 | POC-first: defer the ingestion pipeline. Agree a lean schema (`venues`, `events`, `performances`, `users` — logical domains in `public`), fill it via a versioned seed script, and build the core product feature first. Rename the central entity *piece* → *event*, and model each showing as a `performances` row (event × venue × datetime) rather than a single date on the event. |
| 2026-07-22 | Onboarding's final step seeds taste from a **curated list of past reference pieces** — a first-class concept distinct from the upcoming browse catalogue. | You can only have *loved* a show you've already seen (→ past events), and the set must be deliberately **diverse and highly informative** (spread across genres/styles/venues) so each pick maximally discriminates taste for the future reco engine. Skeleton uses a hardcoded placeholder (`apps/web/lib/reference-pieces.ts`); real curation TBD. | De-risk the product before the pipeline: hand-curated data proves the browse/detail experience in days, whereas ingestion is the hardest, most uncertain part (multi-source + normalization + open legal question) and is cheaper to build once the UI shows which fields actually matter. Provenance columns return when ingestion lands; the OpenAgenda ingester work is shelved on `feature/openagenda-ingester`. |
| 2026-07-23 | App is organised into **three tabs** (À l'affiche · Mon Espace · Ma communauté), shown only to signed-in users; the standalone landing page is dropped (`/` → `/shows`). | Mon Espace is the personal journal (shows *seen* + a one-per-show editable *comment*/review); a show is marked seen by an explicit "Je l'ai vu" toggle **or** as a side effect of reacting (both trigger paths, by request). New tables: `attendance`, `comments`. | Gives logged-in users a reason to return and produces the review content the community feed will surface. |
| 2026-07-23 | **Ma communauté = one-way follow** graph (not mutual friend-request), built in **Phase 2**; connect via **pseudo search + shareable invite link**. Phase 1 ships a placeholder tab. | Follow is lower-friction and faster to build for the POC; the schema is shaped so mutual-accept can be layered on later if wanted. Community feed reuses the `comments` primitive filtered by who you follow, so it's built after Mon Espace. |
| 2026-07-28 | **theatre.info** (Etalab open licence) is the intended **canonical catalogue** source; API key requested as a partner. See `ingestion_worker.md`. | Openly-licensed, reusable, our exact domain (live theatre incl. Paris), commercial use permitted — safe to mirror into our own catalogue with attribution. |
| 2026-07-28 | **Ticketmaster Discovery API** is a **throwaway kickstart**, not a long-term source: use it to seed an initial Paris catalogue so we can **apply for the Awin / France Billet affiliate partnership** (chicken-and-egg: approval needs a live catalogue). Expected to be dropped by launch. See `ingestion_ticketmaster.md`. | TM data is proprietary (ToS + branding guide), not openly reusable — unsuitable as a permanent mirror, but fine as a short-lived bootstrap. TM owns a majority of France Billet, so its Paris inventory overlaps the Awin feed we actually want commission from. |
| 2026-08-01 | `dev_notes.status` becomes a 5-stage lifecycle (`untackled` → `waiting_for_input`/`plan_done` → `implemented_pending_review` → `done`) driven by an on-demand Claude Code skill (`.claude/skills/plan-from-notes/`) that groups backlog notes, asks Théo for missing detail, and writes implementation plans to `docs/plans/`. The skill talks to a new authenticated `/api/dev/notes` route (bearer token via `DEV_NOTES_API_TOKEN`, see runbook §S7) rather than the DB directly, since staging Postgres isn't normally reachable from the Mac Mini. | Backlog triage was manual and stateless (`new`/`processed`); the richer lifecycle is what will power a future notes dashboard. An HTTP API (vs. the existing temporary-public-DB migration dance) keeps the skill genuinely "on demand" — no manual Coolify toggling per run. A later "build from plan" skill is expected to own `plan_done` → `implemented_pending_review`; `done` stays a manual close-out after PR review. |
| 2026-07-30 | Venue & artist pages ship now (pulled forward from Phase 4) as **always-on** (auto-generated from ingestion/seed, not created by a human first), **followable** (`venue_follows`/`artist_follows`, one dedicated table per followable kind rather than a polymorphic `follows` redesign — Postgres FKs can't target "user OR venue OR artist" cleanly), and **claimable** via a manual-review-only queue (`claims`, triaged at `/dev/claims` reusing the `devNotes`/`getDevAccess` allowlist pattern — no email-domain auto-verification), with **minimal self-edit** post-claim (bio/photo/official link only). | The email-domain verification originally sketched in the roadmap was dropped: a V1 audience is too small to need automation, and manual review is cheap to run by hand. Self-edit is deliberately narrow — full programme/show management, a general roles/permissions model, and an audit trail on edits are real Phase-4 items, explicitly deferred, not lost. |
| 2026-08-04 | Venues enriched from a curated 212-theatre list (PR #64) using **stopword-stripped core-token similarity** (generic words like "théâtre"/"centre"/"de/du/la" dropped before scoring) at a 0.75 threshold, not raw normalized-name similarity. | A first attempt at raw-similarity best-guess matching (threshold 0.55, per an explicit "maximize coverage" call) corrupted staging data: short generic theatre names collide easily on edit distance (3 unrelated theatres in different départements all matched onto the same existing venue), and a stale in-memory snapshot bug meant each collision silently overwrote the last one's write. Reverted (lossless, since every touched field had been NULL) and fixed. Any future fuzzy-matching backfill against `venues` should default to core-token similarity with a high bar, dry-run first, and treat missed matches (duplicate rows) as the acceptable failure mode over merged/wrong matches. |
| 2026-08-06 | **Narrow, explicit override of the 2026-07-18 billetreduc retirement**: a one-time bootstrap (`packages/db/seed/list-event-detail-candidates.ts` + `apply-event-details.ts`) may read individual billetreduc show pages as a last-resort fallback for poster/author/director/cast/duration on events ingestion never supplied these for, alongside theatre.info (already-approved canonical source). Scoped strictly to this one-time bootstrap — the 2026-07-18 retirement stands for everything else (no recurring/systematic billetreduc crawl anywhere). Ticketmaster's own `ticketmaster.fr` pages were tried first as a fallback (URLs already stored on `events.ticketUrl`) but return HTTP 401 to plain server-side fetches — a deliberate anti-bot measure, not attempted to bypass. **Extraction itself is agent-assisted, not a separate LLM API integration**: Claude Code fetches and reads each source page directly (Théo's Claude subscription, not a metered Developer Platform API key) and writes results to a JSON patch file; `apply-event-details.ts` is a plain script with no LLM calls, only fills NULL fields, and re-verifies `posterImageUrl`/cast names against a fresh fetch of the source page before writing. | Bounded, one-time reads of individual show pages for events we've already ingested are a different legal shape than the systematic full-catalogue extraction that got billetreduc retired (sui generis DB right targets *repeated/systematic* extraction). Explicit call by Théo, made with the retirement context in view. Agent-assisted (not a standing API integration) because Théo didn't want to pay for separate API usage on top of his existing subscription — this repo carries no `@anthropic-ai/sdk` dependency as a result. |
| 2026-08-06 | **Event-detail bootstrap run and retired**: the one-time script above was actually run against staging in 5 batches, enriching **106 upcoming events** (poster/author/director/duration/cast; sourced mostly from billetreduc's JSON-LD, some from venue sites, none from theatre.info or ticketmaster.fr). Field coverage across the ~593 events with a performance in the next 60 days went from near-zero to 113 with a poster, 70 with an author, 31 with a director, 50 with a duration, 149 with at least one linked cast member. Remaining gaps are mostly small café-théâtre/one-person shows with no public page on any of the three sources, and events too far in the future to have a published show page yet — both correctly skipped rather than guessed. Per the plan, the script is now considered done; it is not scheduled and not wired into `apps/worker`. | Confirms the bounded-read legal framing held up in practice — every write passed the re-fetch/substring verification safety net, and research agents self-reported skips (anti-bot blocks, mismatched-city same-name shows, no accessible page) rather than fabricating data. |

## 14. Glossary

- **Event (formerly Piece)** — a theatre show/production; the central catalogue entity (V1 table: `events`; V0 table: `scenes`). Its venue(s) and dates live in `performances`.
- **Performance** — a single dated showing of an event at a venue (V1 table: `performances`; `event_id` + `venue_id` + `starts_at`).
- **Venue / Salle** — a theatre or performance space. Own page at `/salle/[slug]`; followable, claimable.
- **Artist / Artiste** — a performer, director, or company credited on a show (V1 table: `artists`, linked via `event_artists`). Own page at `/artiste/[slug]`; followable, claimable. No person/company distinction.
- **Carnet** — a user notebook/list of pieces (shareable, V0 feature).
- **Explorer tab** — the taste-based discovery surface.
- **Affiliation** — affiliate/referral commission on ticketing redirects.
