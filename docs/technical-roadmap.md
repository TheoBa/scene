# Scenes — Technical Roadmap (V1)

> Living document. Created 2026-07-18. Sequenced so that each phase de-risks the next.
> Companion docs: `scenes-knowledge-base.md` (product & legal context), `deployment-runbook.md` (infra), `frontend-feature-inventory.md` (V0 audit).

## Sequencing principle

Three things gate everything else, in this order: **can we deploy it** (phase 0), **can we legally fill the catalogue** (phase 1), **can people use it** (phase 2). Monetization and the social flywheel come after, because they're worthless without a live, complete catalogue.

---

## Phase 0 — Infrastructure validation *(current)*

**Goal:** a public HTTPS URL serving the V1 skeleton, redeployed on git push. No features.
**Host:** personal Mac Mini (Apple Silicon) → Ubuntu VM → Coolify, exposed via Cloudflare Tunnel on `scenes.badoz.org`. Free; validates the full path. Hetzner migration deferred to pre-launch.

- [ ] Push repo to GitHub
- [ ] macOS: sleep disabled, auto-restart after power failure
- [ ] Ubuntu 24.04 arm64 VM (UTM), 4 CPU / 8 GB / 80 GB, bridged network
- [ ] Coolify installed, admin secured behind Cloudflare Access
- [ ] Cloudflare Tunnel → `scenes.badoz.org` + `coolify.badoz.org`, running as a systemd service
- [ ] Postgres resource + backups configured **and restore tested**
- [ ] Web app deployed, valid HTTPS via Cloudflare edge
- [ ] Worker deployed
- [ ] Migrations run against the DB
- [ ] Uptime monitoring

**Exit criteria:** the phase-0 checklist in `deployment-runbook.md` is fully green.

**Deferred to pre-launch (Track B):** migrate to a Hetzner VPS and a brand domain. The Mac Mini stays as the staging environment. Don't launch publicly on `badoz.org` — SEO authority and brand equity accrue to the serving domain.

---

## Phase 1 — Catalogue & ingestion

**Goal:** a legally-sourced, daily-refreshed database of Paris theatre. This is the moat; nothing else matters if the catalogue is thin or stale.

1. **OpenAgenda ingester first** — no approval needed, so it validates the whole pipeline shape (fetch → normalize → upsert → provenance).
2. **DATAtourisme ingester** — register for the API key; broader coverage, daily updates, Licence Ouverte 2.0.
3. **Coverage audit** — measure what % of Paris theatre the open-data sources actually cover vs. a manual reference list. *This is the key unknown of the whole project.* If coverage is poor, the venue self-serve path (phase 4) becomes urgent rather than optional.
4. **Entity resolution / dedup** — same show arriving from multiple feeds. Match on normalized title + venue + date range; keep a `source`/`source_ref` provenance trail (already in the schema).
5. **Venue geocoding** — reuse the approach from V0's `geocode-theatres.ts`.
6. **Apply to Awin / France Billet now** — approval takes weeks, so start the paperwork during phase 1 even though the ingester lands in phase 5.
7. **Retire the billetreduc scraper** — hard cutoff once coverage is acceptable.

**Exit criteria:** a cron-run daily job populates pieces/venues/artists with measured coverage and no duplicates; scraping is off.

---

## Phase 2 — Public catalogue (read-only, SEO-first)

**Goal:** anonymous users can find and read about any show. This is the acquisition engine — every piece page is a landing page.

- Piece page (`/piece/[slug]`) — SSR, structured data (schema.org `Event`), synopsis, venue, dates, cast
- Venue page (`/salle/[slug]`), Artist page (`/artiste/[slug]`)
- Home / listing with filters (date, genre, arrondissement)
- Map view (port Leaflet work from V0)
- Search
- `sitemap.xml`, `robots.txt`, OpenGraph images, canonical URLs
- Performance budget: Core Web Vitals green (SEO ranking factor)

**Exit criteria:** Google indexes piece pages; the site is useful to a stranger with no account.

---

## Phase 3 — Accounts & social layer

**Goal:** turn readers into a community.

- better-auth: email magic link + Google, sessions in Postgres, profile completion
- Ratings (1–5) and comments/critiques on pieces
- "Déjà vu" / seen-it marking and personal lists (port V0's *carnets* — a genuinely good V0 idea)
- Follow model — **note the change from V0**: asymmetric follows (not symmetric friendships) to support influencers
- Activity feed from followed accounts
- Shared carnets, invitations (port from V0)
- Moderation basics: report content, admin takedown, rate limits

**Exit criteria:** a user can sign up, rate, list, follow, and see a populated feed.

---

## Phase 4 — Venue & artist portals

**Goal:** supply-side value, and better first-party data than any feed.

- Claim flow: venue/artist claims their auto-generated page (verification by email domain or manual review)
- Venue dashboard: edit venue info, manage its programme, add/update pieces
- Artist profile editing; link self to pieces (V0 had a proposal form — formalize it)
- Roles/permissions model
- Audit trail on edits (feeds back into ingestion as a trusted source)

**Exit criteria:** venues maintain their own pages; first-party data outranks feed data in the merge logic.

---

## Phase 5 — Monetization

**Goal:** revenue stream 1 live.

- France Billet / Fnac Spectacles ingester (post-Awin approval): pieces + `ticketing_offers` with affiliate-decorated URLs
- Ticketmaster Discovery API as second source
- Reservation/redirect UX on piece pages (port V0's `ModaleReservation`)
- Click tracking + attribution reporting so commissions can be reconciled
- Later: venue subscription tiers (revenue stream 2) once reach justifies it

**Exit criteria:** measurable affiliate clicks and first commissions.

---

## Phase 6 — Discovery & recommendations

**Goal:** the Explorer tab — the differentiator, deliberately last because it needs data.

- v1: heuristics (genre/venue affinity, popularity, proximity, "friends liked")
- v2: collaborative filtering once rating volume supports it
- Explorer UI, personalized home
- Evaluation: offline metrics + click-through on recommendations

---

## Cross-cutting (start early, never "done")

**Legal & compliance** — French IP/IT lawyer review of the data sourcing before scale; GDPR: privacy policy, cookie consent, DSR handling (export/delete — V0 had a delete-account function), CNIL-aligned data minimization. Mentions légales + CGU required in France.

**Quality** — TypeScript strict, ESLint, Vitest on ingestion/dedup logic (highest-risk code), Playwright smoke test on the critical path, CI on PRs.

**Ops** — structured logging, error tracking (self-hosted GlitchTip or Sentry), uptime + ingestion-failure alerts, weekly restore drill early on, staging environment once there are real users.

**Design** — the pitch rests on design quality. Establish the design system early (V0's Syne/Tailwind direction is a reasonable starting point) rather than retrofitting.

---

## Known unknowns to resolve

| Question | Blocks | How to resolve |
|---|---|---|
| Do open-data sources actually cover Paris theatre? | Phase 1 exit, whole product | Coverage audit in phase 1 — do this **first** |
| Awin/France Billet approval and commission terms | Phase 5 | Apply now |
| CTO role terms (equity, time, scope) | Everything | Conversation with the CEO |
| Mobile app needed, or is PWA enough? | Architecture (API extraction) | Defer; PWA covers V1 |
