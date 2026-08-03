---
note_ids: ["0a64639a-e735-4a7a-a7c8-bede05cef9b7"]
status: plan_done
created: 2026-08-03
---

# Amazon book affiliate links on show pages

## Source notes
> Ajout de lien d'affiliations vers Amazon livre (pour lire la piece)
> Vers differents acteurs pour preparer sa sortie theatre (restau / taxi etc...) — idea, dropped from /shows/ding

## Problem / request
Originally two ideas bundled in one note: an Amazon Associates link to buy the play's text, plus restaurant/taxi affiliate links for outing prep. Théo confirmed (clarifying question) to scope this plan to **Amazon only for now** — no restaurant/taxi accounts exist yet, so that half stays out of scope until a partnership is in place.

## Proposed approach
1. **Data**: shows (`events`) already have `author` (used in `ShowsPage`'s `FeaturedShow`). Build the Amazon search/affiliate URL from the show's title + author rather than trying to match a specific ISBN/edition — e.g. `https://www.amazon.fr/s?k=<encoded "title author">&tag=<AMAZON_ASSOCIATE_TAG>`. This avoids needing a data-entry step per show and degrades gracefully (a search results page) when no exact book edition exists.
2. **Config**: add `AMAZON_ASSOCIATE_TAG` as an env var (Coolify + local `.env`), read server-side in `apps/web/lib/catalogue.ts` or a small new `apps/web/lib/affiliate.ts` helper `buildAmazonSearchUrl(title, author)`. If the env var is unset, don't render the link at all (mirrors the existing `googleEnabled`-style conditional pattern already used for Google login).
3. **UI**: on `/shows/[slug]`, add a small "Lire la pièce" link/button near the existing show info, using the same visual treatment as `ShareButtons` (pill button style) — icon + "Lire la pièce sur Amazon", opening in a new tab with `rel="nofollow noopener"` (affiliate links should be `nofollow` for SEO hygiene).
4. **Disclosure**: Amazon Associates' terms require disclosing the affiliate relationship near the link — add a small "lien affilié" caption next to the button.

## Out of scope
- Restaurant/taxi/other outing-prep affiliate links — parked until those partnerships exist (per Théo's answer). When they do, this plan's pattern (env-var-gated link builder + pill button) extends directly.
- Per-show manual book-edition curation — search-URL approach only for v1.

## Open questions / risks
- Confirm Théo has (or will register) an Amazon Associates (Amazon.fr) account and has the associate tag before this is built — the plan assumes it exists but the note doesn't confirm it. If not yet set up, treat this as blocked on that account rather than untackled/unclear.
- Amazon Associates has geographic program rules (a `.fr` tag only works with `amazon.fr` links) — confirmed fine since Scene is Paris-only, just don't accidentally link to `.com`.
