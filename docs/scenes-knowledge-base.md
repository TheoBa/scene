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
- `events` — `id`, `venue_id → venues.id`, `name`, `date` (the central "show" entity, **renamed from *piece***)
- `users` — `id`, `pseudo` (unique)

Artists, ratings/comments, ticketing, geocoding (`lat`/`lng`) and provenance (`source`/`source_ref`) columns are deferred until the features that need them, and until automated ingestion returns. Data is filled manually via a versioned seed script (`npm run db:seed`) — no ingestion pipeline in the POC.

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
| 2026-07-21 | POC-first: defer the ingestion pipeline. Agree a lean 3-table schema (`venues`, `events`, `users` — logical domains in `public`), fill it via a versioned seed script, and build the core product feature first. Rename the central entity *piece* → *event*. | De-risk the product before the pipeline: hand-curated data proves the browse/detail experience in days, whereas ingestion is the hardest, most uncertain part (multi-source + normalization + open legal question) and is cheaper to build once the UI shows which fields actually matter. Provenance columns return when ingestion lands; the OpenAgenda ingester work is shelved on `feature/openagenda-ingester`. |

## 14. Glossary

- **Event (formerly Piece)** — a theatre show/production; the central catalogue entity (V1 table: `events`; V0 table: `scenes`).
- **Venue / Salle** — a theatre or performance space.
- **Carnet** — a user notebook/list of pieces (shareable, V0 feature).
- **Explorer tab** — the taste-based discovery surface.
- **Affiliation** — affiliate/referral commission on ticketing redirects.
