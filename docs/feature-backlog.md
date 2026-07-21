# Scenes — Feature Idea Backlog

> Ideation artifact, not a commitment. Created 2026-07-21.
> Purpose: dump, group, and *provisionally* rank every feature idea from the docs and recent
> decisions, so Théo can refine the ranking and pick the first core feature to build.
> Sources: `frontend-feature-inventory.md` (V0 audit), `scenes-knowledge-base.md` (vision §4,
> roles §3, business §5, decision log §13), `technical-roadmap.md` (phases).
> Companion docs: read those three before treating any priority here as settled.

---

## 1. Purpose & current context

Scenes is a social platform for live theatre in Paris — discover, rate, share shows; venue and
artist pages; revenue from ticketing affiliate links, later venue subscriptions.

**Where we actually are (2026-07-21):**

- **POC phase.** Ingestion pipeline is **deferred** (shelved on `feature/openagenda-ingester`).
  The catalogue is filled **manually** via a versioned seed script (`npm run db:seed`).
- **Lean schema — three tables only:**
  - `venues` — `id`, `name` (unique), `address`
  - `events` — `id`, `venue_id → venues.id`, `name`, `date` (the central "show" entity, renamed from *piece*)
  - `users` — `id`, `pseudo` (unique)
- Artists, ratings, comments, follows, ticketing, geocoding (`lat`/`lng`), provenance
  (`source`/`source_ref`) are all **deferred until a feature needs them**.
- **Auth (better-auth) is not yet stood up.** Anything needing user accounts has that as a hard dependency.
- **Immediate open question this doc feeds:** which single *core feature* to build first on top of
  the manually-seeded schema.

**Priority legend.** P0 = POC-critical (candidate for "build first"); P1 = fast-follow; P2 = later.
These are *provisional* — the whole point of the doc is for Théo to re-rank.
**Effort:** S (hours–1 day) · M (a few days) · L (a week+ / genuinely uncertain).

---

## 2. Feature inventory, grouped by theme

### 2.1 Catalogue & data

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Manual seed script | Versioned `db:seed` fills venues/events by hand | roadmap / discussion | **P0** | S | none (exists in plan) |
| Venue records | `venues(id,name,address)` | schema | **P0** | S | none |
| Event records | `events(id,venue_id,name,date)` | schema | **P0** | S | venues |
| Multiple dates per event | A show plays many nights, not one `date` | vision §6 / gap | P1 | M | schema change (dates table or range) |
| Genre / category tagging | Classify events (comedy, drama…) for filters & reco | V0 (category filters) | P1 | S | `events.genre` column |
| Arrondissement / geo on venue | `lat`/`lng` + arrondissement for map & filters | roadmap P2 | P1 | M | geocoding, schema |
| Provenance columns | `source`/`source_ref` on ingested rows | roadmap P1 | P2 | S | needs ingestion |
| OpenAgenda ingester | fetch→normalize→upsert, validates pipeline shape | roadmap P1 | P2 | L | worker, provenance cols |
| DATAtourisme ingester | broader open-data coverage, daily | roadmap P1 | P2 | L | API key, ingester base |
| Que Faire à Paris? ingester | Paris-first open-data events | KB §7 | P2 | L | ingester base |
| Coverage audit | % of Paris theatre covered vs. reference list | roadmap P1 | P2 | M | ingesters |
| Entity resolution / dedup | Match same show across feeds (title+venue+date) | roadmap P1 | P2 | L | multiple ingesters, provenance |
| Venue geocoding script | Port V0 `geocode-theatres.ts` | roadmap P1 / V0 | P2 | M | venue addresses |
| Retire billetreduc scraper | Legal-risk cutoff once coverage OK | KB §7 / decision log | P2 | S | ingestion coverage |

### 2.2 Event / show experience (the "piece page")

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Event detail page | Canonical page per show: info, venue, dates | vision §4 / V0 / roadmap P2 | **P0** | M | events, venues |
| Event listing / browse | List of shows (the entry surface) | V0 / roadmap P2 | **P0** | S | events |
| Synopsis / description | Long text + toggle | V0 | P1 | S | `events.synopsis` column |
| Hero mini-map on event | Small map showing the venue | V0 | P1 | S | geocoding |
| SSR + schema.org `Event` | Structured data for SEO | roadmap P2 | P1 | M | detail page |
| Cast / artists on event | Which artists perform | vision §6 / roadmap P2 | P2 | M | artists table (deferred) |
| Reservation / ticketing modal | Redirect to ticketing partner | V0 (`ModaleReservation`) | P2 | S | ticketing offers |
| Share event modal | Share a show externally | V0 (`SharePieceModal`) | P1 | S | detail page |
| Event editor modal | In-app editing of a show | V0 (`PieceEditorModal`) | P2 | M | auth, roles |

### 2.3 Discovery (map, search, filters, Explorer/reco)

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Interactive Paris map | Leaflet map of venues, pins → detail | V0 / roadmap P2 | P1 | L | geocoding |
| Sidebar + detail panel | List alongside map, select → panel | V0 | P1 | M | map, events |
| Filters (date/genre/arr.) | Narrow the catalogue | V0 / roadmap P2 | P1 | M | genre, geo, dates |
| Search | Find event / venue / artist | vision §4 / roadmap P2 | P1 | M | events (+ artists later) |
| Planificateur ("choisir ma scène") | Guided "choose my show" flow | V0 | P2 | M | filters, taste input |
| À la une / featured | Editorial highlights on home | V0 | P1 | S | events + a `featured` flag |
| Explorer tab (heuristic reco) | Taste-based discovery (genre/venue affinity, popularity) | vision §4 / roadmap P6 | P2 | L | ratings/behaviour data |
| Explorer v2 (collaborative filtering) | Reco once rating volume supports it | roadmap P6 | P2 | L | rating volume |
| Personalized home | Home reorders by taste | roadmap P6 | P2 | M | reco engine |

### 2.4 Social (ratings, comments, carnets/lists, follows, feed, invitations)

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Ratings (1–5) | Rate a show | vision §4 / roadmap P3 / gap | P1 | M | **auth**, `ratings` table |
| Comments / critiques | Write reviews on a show | vision §4 / V0 / roadmap P3 | P1 | M | **auth**, `comments` table |
| "Déjà vu" (seen-it) marking | Mark a show as seen | V0 (`ModaleDejaVu`) | P1 | S | **auth**, join table |
| Carnets (personal lists) | Notebooks/lists of shows | V0 / roadmap P3 | P1 | M | **auth**, notebooks tables |
| Shared carnets | Notebooks shared between members | V0 / roadmap P3 | P2 | M | carnets, follows |
| Follows (asymmetric) | Follow friends **and influencers** (change from V0's symmetric friendships) | roadmap P3 / gap | P1 | M | **auth**, `follows` table |
| Activity feed | Feed from followed accounts | vision §4 / V0 / roadmap P3 | P2 | L | follows, ratings, comments |
| Invitations by token | Invite flow `/invite/[token]` | V0 / roadmap P3 | P2 | M | **auth** |
| Members panel | Browse/see other members | V0 (`MembresPanel`) | P2 | S | **auth** |

### 2.5 Venue & artist portals

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Venue page (`/salle/[slug]`) | Venue-managed page aggregating its programme | vision §4 / roadmap P2/P4 | P1 | M | venues, slugs |
| Artist page (`/artiste/[slug]`) | Profile per artist, linked to their shows | vision §4 / roadmap P2/P4 | P2 | M | artists table |
| Artist mode on profile | Flag a user as artist | V0 | P2 | S | **auth**, roles |
| Artist show-proposal form | Artist proposes a show | V0 (`scenes_proposees`) | P2 | M | **auth**, roles |
| Venue/artist claim flow | Claim auto-generated page (email/manual verify) | roadmap P4 | P2 | L | **auth**, roles, pages |
| Venue dashboard | Edit venue info, manage programme | roadmap P4 | P2 | L | claim, roles |
| Roles / permissions model | user / venue / artist / admin | roadmap P4 | P2 | M | **auth** |
| Edit audit trail | Track edits, feed back as trusted source | roadmap P4 | P2 | M | dashboard, ingestion |

### 2.6 Monetization (ticketing / affiliate)

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Ticketing offers on events | External link per show | vision §6 / roadmap P5 | P2 | M | `ticketing_offers` table |
| Affiliate link decoration | Awin/Impact tracking params per partner | KB §11 / roadmap P5 | P2 | M | offers, partner approval |
| Reservation/redirect UX | Port V0 `ModaleReservation` | roadmap P5 / V0 | P2 | S | offers |
| France Billet (Awin) ingester | Bookable inventory + revenue, 60k events/yr | KB §7 / roadmap P5 | P2 | L | Awin approval, ingester base |
| Ticketmaster Discovery source | Second affiliate source | KB §7 / roadmap P5 | P2 | L | API key, ingester base |
| See Tickets / Fever source | Powers major Paris houses (Odéon) | KB §7 | P2 | L | affiliate approval |
| Click tracking + attribution | Reconcile commissions | roadmap P5 | P2 | M | redirect UX |
| Venue subscription tiers | Revenue stream 2 (paid venue tools) | vision §5 / roadmap P5 | P2 | L | venue portal, reach |

### 2.7 Engagement & gamification

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Trophies page | Gamified achievements | V0 (`/trophees`) | P2 | M | **auth**, activity data |
| "Porte Paradis" modal | V0 gamification modal | V0 (`ModalePorteParadis`) | P2 | S | **auth** |
| Survey / sondage modal | In-app survey | V0 (`ModaleSondage`) | P2 | S | **auth** |
| Welcome email | Transactional onboarding email (Resend) | V0 / KB §11 | P2 | S | **auth**, Resend |

### 2.8 App shell & polish

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| Design system | Syne/Tailwind direction, established early | roadmap cross-cutting | **P0** | M | none |
| PWA (installable + update banner) | Installable app, update prompt | V0 (next-pwa) | P2 | M | app shell |
| Splash screen | Branded load screen | V0 | P2 | S | app shell |
| Landscape-lock overlay | Portrait-only guard on mobile | V0 | P2 | S | app shell |
| Legal footer | Mentions légales / links | V0 / roadmap | P1 | S | legal pages |
| Contact page | `/contact` | V0 | P2 | S | (email) |
| Read-text / banner modals | Misc UI modals | V0 | P2 | S | app shell |

### 2.9 Platform / quality (auth, SEO, moderation, ops, GDPR/legal)

| Feature | What it is | Source | Prio | Effort | Key deps |
|---|---|---|---|---|---|
| better-auth (magic link + Google) | Accounts, sessions in Postgres, profile completion | roadmap P3 / KB §11 | P1 | L | Postgres, Resend |
| Programmatic SEO (sitemap, robots, OG, canonical) | Every event/venue page a landing page | roadmap P2 / KB §11 | P1 | M | detail pages, SSR |
| Core Web Vitals budget | Perf as ranking factor | roadmap P2 | P1 | M | SSR pages |
| Moderation basics | Report content, admin takedown, rate limits | roadmap P3 | P2 | M | **auth**, social content |
| GDPR: privacy policy + cookie consent | CNIL-aligned, required in France | roadmap cross-cutting | P1 | S | legal review |
| GDPR: data export / delete (DSR) | Port V0 delete-account | roadmap / V0 | P2 | M | **auth** |
| Mentions légales + CGU | Required in France | roadmap cross-cutting | P1 | S | legal review |
| Legal review of data sourcing | French IP/IT lawyer before scale | KB §7 / roadmap | P1 | — | (external) |
| Observability (logging, error tracking) | Structured logs, GlitchTip/Sentry, uptime alerts | roadmap cross-cutting | P1 | M | infra |
| Ingestion-failure alerts | Alert when a feed job fails | roadmap cross-cutting | P2 | S | ingestion |
| CI + tests (Vitest, Playwright) | Strict TS, ESLint, test dedup logic + critical path | roadmap cross-cutting | P1 | M | CI setup |
| Backup + restore drill | Postgres backups, restore tested | roadmap P0 | **P0** | S | infra |

---

## 3. POC core-feature shortlist

Candidates for the *single first core feature* to build on the lean schema. All assume the seed
script populates `venues` + `events`. Only auth-free or minimal-schema options qualify as true P0.

| # | Candidate | What it proves | Schema it needs added | Effort | Why it might / might not be first |
|---|---|---|---|---|---|
| A | **Browse + Event detail page** (listing → SSR event page → venue) | The core read experience and the SEO thesis (every event page is a landing page). Zero auth. | none (maybe `events.synopsis`) | M | **Strongest first bet:** no auth dependency, directly on lean schema, matches roadmap P2, immediately demoable and shareable. Risk: unglamorous, doesn't prove the *social* differentiator. |
| B | **Map discovery** (Leaflet map of venues → detail panel) | The signature V0 UX and Paris-centric discovery feel. | `venues.lat`/`lng` (+ a geocode step) | L | Highest "wow", best pitch material. But needs geocoding work first and leans on a heavier UI; slower to a demo than A. |
| C | **Ratings on events** (1–5, aggregate score shown) | The rate-and-share loop — the product's reason to exist. | **auth** + `ratings(user_id,event_id,score)` | M–L | Proves the differentiator, but **blocked on standing up better-auth** — violates "buildable on lean schema now". Better as fast-follow once A exists. |
| D | **Carnets / personal lists** ("shows I want to see" / "déjà vu") | Personal utility and retention hook; a genuinely good V0 idea. | **auth** + `notebooks` + `notebook_items` | M | Great engagement feature, but also auth-gated. Do after auth + A. |
| E | **Filtered catalogue** (browse + date/genre/arrondissement filters) | That the catalogue is navigable and the data model supports discovery. | `events.genre`, dates handling, venue arrondissement | M | Natural extension of A; arguably part of A rather than a separate first bet. |

**Provisional recommendation (a starting point, not a decision):** build **Candidate A — Browse +
Event detail page** first. It's the only shortlist item with **no auth dependency**, sits directly
on the three-table schema, aligns with roadmap Phase 2 (public catalogue = the acquisition engine),
and produces a shareable public artifact within the POC. Fold in a minimal slice of **E** (at least a
date sort and one filter) if it's cheap. Then stand up **auth** and layer **C (ratings)** as the
first social loop, followed by **D (carnets)**.

**Tension to flag:** the product's *differentiator* is social/reco (ratings, follows, Explorer), but
those all sit behind auth and richer data. The honest POC move is to prove the *read* experience
first (A) and treat the social loop as the very next step — accepting that the first demo won't yet
show the thing that makes Scenes special.

---

## 4. Sequencing sketch (provisional, POC-first)

Consistent with the roadmap phases but reflecting the "core feature first, ingestion deferred" reality.

| Order | Epic | Rationale |
|---|---|---|
| 0 | **Infra green + backup/restore + design system** | Roadmap P0; can't demo or trust data without it. Design system early (pitch rests on design). |
| 1 | **POC core: Browse + Event detail (Candidate A)** | Prove the read experience on seeded data, no auth. Shareable. |
| 2 | **Filters + featured + basic search** | Make the catalogue navigable; still auth-free. |
| 3 | **Auth (better-auth)** | Unlocks the entire social layer; the gating dependency. |
| 4 | **Social loop v1: ratings + déjà-vu + carnets** | The differentiator's first increment. |
| 5 | **Follows + activity feed** | Asymmetric follows (influencer-ready), feed. |
| 6 | **SEO hardening + map discovery** | Programmatic SEO for acquisition; port Leaflet map (needs geocoding). |
| 7 | **Ingestion returns (OpenAgenda → DATAtourisme → coverage audit → dedup)** | Roadmap P1, un-deferred once UI proves which fields matter. **The key unknown.** |
| 8 | **Venue & artist portals** | Supply-side + first-party data; also urgent-fallback if open-data coverage is poor. |
| 9 | **Monetization (France Billet/Awin, offers, redirect, tracking)** | Revenue stream 1; apply for Awin *during step 7*, lead time is weeks. |
| 10 | **Explorer / recommendations** | Deliberately last — needs rating + behaviour data to work. |
| — | **Cross-cutting, always on:** legal review, GDPR/CGU, moderation, observability, CI/tests | Start early, never "done". |

**Note the ordering tension with the roadmap:** the roadmap gates everything behind Phase 1
(ingestion). The POC decision deliberately inverts this for now — build the product on manual data
first, bring ingestion back at step 7. Keep the roadmap as the *scale* plan; this sketch is the
*POC* plan.

---

## 5. Top open decisions for Théo

1. **Which core feature first?** Provisional pick is **A (Browse + Event detail)** because it needs
   no auth. Confirm, or override toward **B (map)** for pitch impact or **C (ratings)** for the
   differentiator (accepting the auth dependency moves up).
2. **How soon does auth land?** Everything social (ratings, carnets, follows, feed, portals,
   gamification) is blocked on better-auth. Decide whether to stand it up immediately after the
   read-only POC or defer further.
3. **One `date` vs. multiple dates per event.** A real show plays many nights. The lean schema has a
   single `events.date`. Decide when to model a date range / dates table — it affects filters,
   listing, and the detail page early.
4. **Geocoding now or later?** Map discovery (B) and the hero mini-map need `lat`/`lng`. Decide
   whether to add geocoding during the POC (unlocks the signature map UX) or defer with the rest of
   ingestion.
5. **When does ingestion come back, and does the coverage audit happen before or after monetization
   paperwork?** Awin/France Billet approval takes weeks — deciding to apply *now* (even while
   ingestion is shelved) may be worth it to avoid blocking Phase 5 later.
