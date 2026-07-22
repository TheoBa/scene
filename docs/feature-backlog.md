# Scenes — Feature Idea Backlog

> Ideation + prioritisation artifact, not a hard commitment.
> Created 2026-07-21. **Re-ranked 2026-07-22** to reflect what has actually shipped.
> Purpose: track every feature idea, grouped and prioritised, so the next build is an obvious pick.
> Sources: `frontend-feature-inventory.md` (V0 audit), `scenes-knowledge-base.md`, `technical-roadmap.md`.

---

## 1. Where we actually are (2026-07-22)

The POC has moved fast. The read experience **and** auth are already live on `scenes.badoz.org`.

**Shipped:**

- **Design system** — Syne + Tailwind 4 tokens, established early.
- **Catalogue schema** (evolved past the original "3 lean tables"):
  - `venues` — `id`, `name` (unique), `address`
  - `events` — `id`, `name`, `slug` (unique) — the "show" entity
  - `performances` — `id`, `event_id`, `venue_id`, `starts_at` — **one row per showing** (multiple dates per show, solved)
- **Auth (better-auth)** — email/password live; Google OAuth is a config drop-in (client not yet created). Owns `user`/`session`/`account`/`verification`.
- **Profiles + onboarding** — `profiles` (`pseudo`, `frequency`, `favorite_genres[]`, `onboarded_at`) and `reference_likes` (cold-start taste signal). 3-step onboarding wizard captures & persists taste; gated behind a session.
- **Catalogue browsing (the old "Candidate A")** — public `/shows` discovery list + `/shows/[slug]` piece page, live DB reads, SEO metadata per page. Seeded with 5 shows / 4 venues.
- **Infra** — staging deploys from `dev` via Coolify + Cloudflare Tunnel; migrations run via a documented flow (runbook S5).

**Not yet done / deferred:** ratings, comments, ticketing, follows/feed, carnets, search/filters, venue/artist pages, map, **real catalogue data at scale**, automated ingestion, SEO hardening (sitemap/schema.org), most platform/legal items.

**Priority legend (post-read-experience, post-auth).** ✅ = shipped · **P0** = build next · P1 = fast-follow · P2 = later.
**Effort:** S (hours–1 day) · M (a few days) · L (a week+ / genuinely uncertain).

---

## 2. The two things that matter most next

Everything below is real, but two items dominate the next stretch:

### ⭐ A. Populate the catalogue with real Paris theatre data — **P0**
> *Added at Théo's request: "feed our database with events so the website actually displays stuff."*

Right now `/shows` lists **5 hand-seeded example shows**. That's a plumbing demo, not a product — nobody can *use* the site and no piece page can rank until it holds real, current Paris theatre. This is the gate on the whole "comprehensive live knowledge base" thesis. It's a **spectrum**, done in stages:

| Stage | What | Prio | Effort | Notes |
|---|---|---|---|---|
| A1 | **Real manual seed** — hand-curate a sizeable, *current* set (dozens of shows across many venues) into `db:seed` | **P0** | M | Legal, fast, zero infra. Makes the site look real for the pitch/first users. Goes stale — a stopgap, not the answer. |
| A2 | **Seed ergonomics** — make adding shows cheap (CSV/JSON import, a tiny admin form, or a well-structured seed file) | P1 | M | Lowers the cost of A1 so the catalogue can be kept fresh by hand during the POC. |
| A3 | **Automated ingestion returns** — OpenAgenda → DATAtourisme → France Billet; normalize + upsert + dedup | P1→P2 | L | The real long-term answer (see §3.1). Un-defer once the UI has proven which fields matter. Awin/France Billet approval has weeks of lead time — **apply now**. |

**Recommendation:** do **A1 now** (a real seed), build **A2** so it stays maintainable, and treat **A3** (ingestion) as the next big epic after the first social loop. Don't block the product on the full pipeline.

### ⭐ B. Ratings — **P0**
The social differentiator, and now **unblocked** (auth + profiles exist). First authenticated *write* from a normal page; feeds the future recommendation engine that onboarding already primes. Needs a `ratings(user_id, event_id, score)` table + aggregate on the piece page. Effort: M.

*(Ticketing — the revenue mechanic — is the strongest P1 right after these; small and self-contained on the piece page, but gated on partner/affiliate approval, so start that paperwork in parallel.)*

---

## 3. Full inventory, grouped by theme (re-ranked)

### 3.1 Catalogue & data

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Manual seed script | Versioned `db:seed` fills venues/events/performances | ✅ | S | — |
| Venue / event / performance records | Core catalogue tables (multi-date solved via `performances`) | ✅ | S | — |
| Event slug | Readable/crawlable piece-page URLs | ✅ | S | — |
| **Real manual seed (A1)** | Hand-curate real current Paris shows at volume | **P0** | M | seed |
| **Seed ergonomics (A2)** | Cheap bulk entry (import/admin form) | P1 | M | seed |
| Genre / category tagging | `events.genre` for filters + reco (ties to onboarding genres) | P1 | S | schema |
| Arrondissement / geo on venue | `lat`/`lng` + arrondissement for map & filters | P1 | M | geocoding |
| Venue geocoding script | Port V0 `geocode-theatres.ts` | P1 | M | venue addresses |
| OpenAgenda ingester (A3) | fetch→normalize→upsert; validates pipeline shape | P1 | L | worker |
| Provenance columns | `source`/`source_ref` on ingested rows | P1 | S | ingestion |
| DATAtourisme ingester | Broader open-data coverage, daily | P2 | L | ingester base |
| Que Faire à Paris? ingester | Paris-first open-data events | P2 | L | ingester base |
| Entity resolution / dedup | Match same show across feeds | P2 | L | multiple ingesters |
| Coverage audit | % of Paris theatre covered vs. reference list | P2 | M | ingesters |
| Retire billetreduc scraper | Legal-risk cutoff once coverage OK | P2 | S | ingestion coverage |

### 3.2 Event / show experience (the piece page)

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Event listing / browse | `/shows` discovery list | ✅ | S | — |
| Event detail page | `/shows/[slug]` piece page | ✅ | M | — |
| Ratings on the piece page | 1–5 + aggregate score (see §2.B) | **P0** | M | auth ✅, `ratings` table |
| Ticketing / reservation button | Redirect to partner, affiliate-decorated | P1 | S | ticketing offers |
| Synopsis / description | `events.synopsis` + long text | P1 | S | schema |
| Cast / artists on event | Which artists perform | P2 | M | artists table |
| Hero mini-map on event | Small map of the venue | P2 | S | geocoding |
| Share event | Share a show externally | P2 | S | — |
| Event editor (in-app) | Edit a show | P2 | M | auth ✅, roles |

### 3.3 Discovery (search, filters, map, Explorer/reco)

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Filters (date / genre / arrondissement) | Narrow the catalogue | P1 | M | genre, geo |
| Search | Find event / venue / artist | P1 | M | events |
| À la une / featured | Editorial highlights on home | P1 | S | `featured` flag |
| Interactive Paris map | Leaflet map of venues → detail | P2 | L | geocoding |
| Sidebar + detail panel | List alongside map | P2 | M | map |
| Planificateur ("choisir ma scène") | Guided "choose my show" | P2 | M | filters, taste |
| Explorer tab (heuristic reco) | Taste-based discovery | P2 | L | ratings/behaviour |
| Explorer v2 (collaborative filtering) | Reco at rating volume | P2 | L | rating volume |
| Personalized home | Home reorders by taste | P2 | M | reco |

### 3.4 Social (ratings, comments, lists, follows, feed)

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Ratings (1–5) | *(listed in §3.2, the P0)* | **P0** | M | auth ✅ |
| Comments / critiques | Reviews on a show | P1 | M | auth ✅, `comments` |
| "Déjà vu" (seen-it) marking | Mark a show as seen | P1 | S | auth ✅, join table |
| Carnets (personal lists) | Notebooks/lists of shows | P1 | M | auth ✅, notebooks tables |
| Follows (asymmetric) | Follow friends **and influencers** | P1 | M | auth ✅, `follows` |
| Shared carnets | Notebooks shared between members | P2 | M | carnets, follows |
| Activity feed | Feed from followed accounts | P2 | L | follows, ratings |
| Invitations by token | `/invite/[token]` | P2 | M | auth ✅ |
| Members panel | Browse other members | P2 | S | auth ✅ |

### 3.5 Venue & artist portals

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Venue page (`/salle/[slug]`) | Venue page aggregating its programme | P1 | M | venues ✅ (+ slug) |
| Artist page (`/artiste/[slug]`) | Profile per artist, linked to shows | P2 | M | artists table |
| Artist mode on profile | Flag a user as artist | P2 | S | auth ✅, roles |
| Artist show-proposal form | Artist proposes a show | P2 | M | auth ✅, roles |
| Venue/artist claim flow | Claim auto-generated page | P2 | L | auth ✅, roles, pages |
| Venue dashboard | Edit venue, manage programme | P2 | L | claim, roles |
| Roles / permissions model | user / venue / artist / admin | P2 | M | auth ✅ |

### 3.6 Monetization (ticketing / affiliate)

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Ticketing offers on events | External link per show | P1 | M | `ticketing_offers` table |
| Affiliate link decoration | Awin/Impact tracking params | P1 | M | offers, **partner approval (apply now)** |
| Reservation/redirect UX | Port V0 `ModaleReservation` | P1 | S | offers |
| France Billet (Awin) ingester | Bookable inventory + revenue | P2 | L | Awin approval |
| Ticketmaster / See Tickets / Fever sources | More affiliate inventory | P2 | L | affiliate approval |
| Click tracking + attribution | Reconcile commissions | P2 | M | redirect UX |
| Venue subscription tiers | Revenue stream 2 | P2 | L | venue portal, reach |

### 3.7 Engagement, app shell & polish

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| Legal footer + mentions légales/CGU | Required in France | P1 | S | legal pages |
| Welcome email (Resend) | Transactional onboarding email | P1 | S | auth ✅, Resend |
| Trophies / gamification | Achievements, V0 modals | P2 | M | auth ✅, activity data |
| Survey / sondage modal | In-app survey | P2 | S | auth ✅ |
| PWA (installable + update banner) | Installable app | P2 | M | app shell |
| Splash / landscape-lock / misc modals | V0 polish | P2 | S | app shell |
| Contact page | `/contact` | P2 | S | email |

### 3.8 Platform & quality (auth, SEO, moderation, ops, legal)

| Feature | What it is | Prio | Effort | Key deps |
|---|---|---|---|---|
| better-auth (accounts, sessions) | email/pw ✅; Google = config drop-in | ✅/🔨 | L | Google client (Théo) |
| Programmatic SEO (sitemap, robots, OG, schema.org `Event`, canonical) | Every event/venue page a landing page | P1 | M | piece pages ✅ |
| Core Web Vitals budget | Perf as ranking factor | P1 | M | SSR pages ✅ |
| GDPR: privacy policy + cookie consent | CNIL-aligned, required in France | P1 | S | legal review |
| Legal review of data sourcing | French IP/IT lawyer before scale | P1 | — | external |
| Observability (logging, error tracking, uptime) | Structured logs, Sentry/GlitchTip | P1 | M | infra |
| CI + tests (Vitest, Playwright) | Strict TS, test critical paths + dedup | P1 | M | CI setup |
| Backup + restore drill | Postgres backups, **restore tested** | **P0** | S | infra |
| Moderation basics | Report content, takedown, rate limits | P2 | M | auth ✅, social content |
| GDPR: data export / delete (DSR) | Port V0 delete-account | P2 | M | auth ✅ |
| Ingestion-failure alerts | Alert when a feed job fails | P2 | S | ingestion |

---

## 4. Sequencing sketch (re-ranked, POC-first)

| Order | Epic | Status / rationale |
|---|---|---|
| 0 | Infra green + **backup/restore drill** + design system | Infra ✅, design ✅. **Backup/restore still owed (P0).** |
| 1 | POC read experience: browse + piece page | ✅ done |
| 2 | Auth + onboarding (taste capture) | ✅ done |
| 3 | **Real catalogue data — A1 manual seed at volume** | **Next (P0).** Site isn't usable/rankable on 5 example shows. |
| 4 | **Ratings (social loop v1)** | **Next (P0).** Differentiator's first increment; unblocked by auth. |
| 5 | Ticketing link + reservation UX (+ **start Awin/France Billet approval now**) | P1 revenue; paperwork lead time is weeks. |
| 6 | SEO hardening (sitemap/robots/OG/schema.org) + filters + search + venue pages | P1 acquisition + navigability; piece/venue pages exist. |
| 7 | Social depth: comments, déjà-vu, carnets, follows + feed | P1→P2 retention. |
| 8 | **Ingestion returns — A3** (OpenAgenda → DATAtourisme → dedup → coverage audit) | P1→P2. The scale answer to data; un-defer once fields are proven. |
| 9 | Venue & artist portals (claim, dashboard, roles) | P2 supply-side + first-party data. |
| 10 | Monetization depth (offers, tracking) + Explorer/reco | P2. Reco last — needs rating volume (onboarding seeds cold-start). |
| — | Cross-cutting, always on: legal review, GDPR/CGU, moderation, observability, CI/tests | Start early, never "done". |

---

## 5. Top open decisions for Théo

1. **Next build: real data (A1) or ratings (B) first?** Both are P0. My lean: **A1 first** — ratings on 5 example shows proves little, whereas a real catalogue makes *everything* (ratings, SEO, pitch) land. But if the goal is to demo the *social differentiator*, ratings first is defensible.
2. **How real does A1 need to be?** A curated ~30–50 current shows across ~15 venues is enough to feel real without being ingestion. Decide the scope of the manual pass.
3. **Start Awin / France Billet approval now?** It has weeks of lead time and gates all revenue. Applying while ticketing is still P1 avoids a stall later.
4. **Genre on `events` now?** Cheap, and it connects the catalogue to the `favorite_genres` onboarding already collects — unlocks filters *and* the first reco heuristic. Add during A1?
5. **When does automated ingestion (A3) come back?** Kept deferred; the trigger is "the UI has proven which fields matter." Confirm that's after the first social loop.
