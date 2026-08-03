---
note_ids: ["7ba63e5c-5b51-4eca-a377-75242d86112b", "8ec2f66c-44a0-434c-b04b-1f4fe0121a20", "c023f80d-3140-4977-aec3-d09c7a9b66b9"]
status: implemented_pending_review
created: 2026-08-03
pr: https://github.com/TheoBa/scene/pull/62
---

# Profile completion gauge

## Source notes
> Incentive a utiliser l'app: Gamification sur le profil — idea, dropped from /communaute

> Creer un espace profil qui centralise des informations (a rafiner) — idea, dropped from /dev/notes

> Parcours utilisateur: Une jauge `complete ton profil` qui incite l'utilisateur a remplir ses reseaux sociaux et a interagir avec les features du site (suivre x comptes / renseigner x pieces comme etant vues / etc...) — idea, dropped from /shows

## Problem / request
Three separate notes all point at the same underlying want: profile pages feel thin, and nothing currently nudges a user to invest in the product (add socials, follow people, mark shows as seen). Théo confirmed (via clarifying question) the concrete first step: a completion gauge, not a points/badges system — the other two notes were the vaguer restatement of the same idea and are folded into this one plan.

Today `profiles` only has `pseudo`, `frequency`, `favoriteGenres` — there's no bio or social-links field, and no visible progress indicator anywhere.

## Proposed approach

1. **Schema** (`packages/db/src/schema.ts`): add nullable columns to `profiles` — `bio: text`, `instagramHandle: text`, `websiteUrl: text`. Keep it to these three; no need for a generic JSON blob given the small, fixed set of fields. Generate + apply a Drizzle migration (`npm run db:generate`, `npm run db:migrate`).
2. **Completion calculation** (new `apps/web/lib/profile-completion.ts`): a pure function `computeCompletion(input): { percent: number; missing: ChecklistItem[] }` over a fixed weighted checklist:
   - pseudo set (always true post-onboarding — exclude it, it's not a real signal)
   - `bio` filled
   - at least one of `instagramHandle` / `websiteUrl` filled
   - following ≥ 3 people (`follows` count where `followerId = userId`)
   - ≥ 1 show marked seen (`attendance` count)
   - ≥ 1 review written (`comments` count)
   Each item worth an equal share; `percent = filled / total * 100`.
3. **Data**: a `getProfileCompletion(userId)` query in `apps/web/lib/community.ts` (or a new `profile-completion-query.ts` to keep the pure calculator test-friendly) joining `profiles`, `follows`, `attendance`, `comments` counts.
4. **UI**: a `ProfileCompletionGauge` component — a circular or bar progress indicator plus a short list of the missing items as actionable links (`Ajouter ta bio → /mon-espace/editer`, `Suivre des amis → /communaute`, etc.). Show it on `/mon-espace` (the profile/personal-space page) above the fold; dismissible once at 100%, otherwise always visible (no need for a "hide forever" toggle in v1 — this is a young product with low usage, better to keep the nudge visible).
5. **Editing bio/socials**: `/mon-espace` currently has no self-edit form beyond what onboarding set — add a small inline edit form (or extend `apps/web/app/mon-espace/actions.ts`) for `bio` / `instagramHandle` / `websiteUrl`, reusing the existing server-action pattern in that file.
6. Surface `instagramHandle` / `websiteUrl` (if set) on the public profile (`/u/[pseudo]`) too, since they're social-proof info other users would want to see, not just a private checklist item.

## Out of scope
- Points/badges/streaks gamification (Théo explicitly deferred this).
- A "hide this forever" dismiss control — revisit once there's usage data.
- Any onboarding-flow changes; this only affects the post-onboarding profile page.

## Open questions / risks
- Confirm the exact checklist weighting (currently proposed as 5 equally-weighted items) matches what Théo wants surfaced first — easy to rebalance later since it's a pure function.
- `instagramHandle` here is just a text handle for display (a link to instagram.com/<handle>), unrelated to the separate social-**login** request (see the social-login plan) — don't conflate the two while building.
