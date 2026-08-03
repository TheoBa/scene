---
note_ids: ["fbbdf738-2a6e-4498-8bbc-6a1169a2c453"]
status: implemented_pending_review
created: 2026-08-03
pr: https://github.com/TheoBa/scene/pull/61
---

# "À l'affiche" → "À la une": personalized + curated carousels

## Source notes
> L'onglet 'A l'affiche' a renommer en 'A la une', doit proposer une interface plus sur-mesure par rapport a l'utilisateur au moyen de carousels — idea, dropped from /shows

## Problem / request
Rename the main tab and redesign `/shows` from a single grid into a set of horizontally-scrolling carousels. Théo specified (clarifying answer) the exact carousel set wanted:
- **"Pour toi"** (personalized: based on follows + past ratings/genres), which — when the signal is thin — should itself surface prompts like "Suis plus d'artistes" / "Complète ta description de profil" instead of staying empty.
- **"Populaire près de chez vous"** (curated, not personalized)
- **"Salles près de chez vous"** (curated)
- **"Artistes qui pourraient te plaire"** (curated but per-user, see below)
- **"Utilisateurs populaires à suivre"** (curated)

## Proposed approach
1. **Rename**: `apps/web/components/TabNavClient.tsx` — `"À l'affiche"` → `"À la une"`. Update the page's `<h1>` and `metadata.title` in `apps/web/app/shows/page.tsx` to match.
2. **Layout**: replace the single featured-show + grid layout in `ShowsPage` with a stack of horizontally-scrollable carousel sections (a shared `Carousel` component — a flex row with `overflow-x-auto`, snap scrolling via `scroll-snap-type`, reusing the existing `ShowPoster`/venue-card/artist-card visual styles per carousel's content type). Logged-out visitors see only the curated, non-personalized carousels (no "Pour toi", no follows-based logic).
3. **"Pour toi" carousel** (`apps/web/lib/catalogue.ts`, new query): shows from followed artists/venues (`eventArtists` join `artistFollows`, `venues` join `venueFollows`) plus shows matching the user's `favoriteGenres` and highly-reacted-to genres from their own `reactions` history, deduped and ranked by upcoming date. When the resulting set is below a minimum threshold (e.g. < 4 shows), render 1-2 prompt cards inline in the same carousel: "Suis plus d'artistes →" (`/artiste`) and, if the profile-completion gauge (`2026-08-03-profile-completion-gauge.md`) work has landed, "Complète ton profil →" (`/mon-espace`) — otherwise link straight to whatever profile page exists at build time.
4. **"Populaire près de chez vous"** (new query in `catalogue.ts`): shows ranked by attendance/reaction count at venues within some radius of the user's location. Needs a location source — venues already have `lat`/`lng` (from Ticketmaster, per recent work) but **the user's own location does not exist anywhere yet**. Use browser geolocation (`navigator.geolocation`, permission-gated, client-side) to get the viewer's coordinates and pass them to the server query; if permission is denied or unavailable, fall back to city-wide "Popular in Paris" (no distance filter) rather than hiding the carousel.
5. **"Salles près de chez vous"** (`apps/web/lib/venues.ts`, new query): same distance-from-viewer logic as above, listing venues instead of shows, sorted by distance.
6. **"Artistes qui pourraient te plaire"** (`apps/web/lib/artists.ts`, new query): simplest v1 heuristic — artists sharing a genre with the user's `favoriteGenres` that the user doesn't already follow, ranked by follower count or upcoming-show count. Not full collaborative filtering; that's future work if this heuristic underperforms.
7. **"Utilisateurs populaires à suivre"** (`apps/web/lib/community.ts`, new query): profiles ranked by follower count, excluding the viewer and anyone already followed, similar shape to the existing `searchPeople`.

## Out of scope
- Real collaborative filtering / ML-based recommendations — all "personalization" here is rule-based on follows/genres/location, matching the product's current stage.
- Geolocation-based carousels for logged-out visitors (they get the curated, non-personalized carousels without a location prompt).
- Carousel content caching/precomputation — compute on request for v1, revisit if `/shows` load time becomes a problem.

## Open questions / risks
- Geolocation permission UX: decide whether to prompt immediately on page load or behind a "Voir près de chez vous" button — an unprompted browser permission dialog on first visit is often a bad first impression; recommend gating behind a button or lazy-triggering on scroll-into-view of that carousel.
- "Populaire" needs a minimum viable definition of popularity (attendance count vs. reaction count vs. review count) — pick one (recommend attendance count, it's the least gameable) and note it's tunable.
- This is the largest of the plans in this batch (5 new carousels, 2 new query modules' worth of work, a new geolocation flow) — consider sequencing it as its own multi-PR effort rather than one shot, e.g. rename + curated carousels first, "Pour toi" + geolocation-based ones second.
