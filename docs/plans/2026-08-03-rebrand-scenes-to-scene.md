---
note_ids: ["eb6245c3-b5bc-428a-afb9-b723286ef5bd"]
status: plan_done
created: 2026-08-03
---

# Rebrand "Scenes" → "Scene" in user-facing text

## Source notes
> Il faut corriger SCENES en SCENE partout dans le produit — bug, dropped from /shows

## Problem / request
The product should read as singular "Scene" everywhere a user sees it, not "Scenes". This is scoped to **user-facing copy only** — not the repo folder, the `@scenes/db` package name, or the `scenes.badoz.org` domain, none of which are visible to end users and none of which the note's wording ("dans le produit") implies changing.

Confirmed occurrences of the user-facing string today:
- `apps/web/components/SplashScreen.tsx:6` — `const WORD = "SCENES";` (the splash-screen wordmark animation)
- `apps/web/components/SiteHeader.tsx:16` — `Scenes` (top-bar wordmark, every page)
- `apps/web/app/layout.tsx:16` — root `<title>` metadata
- `apps/web/app/sign-in/page.tsx:9`, `apps/web/app/sign-up/page.tsx:9`, `apps/web/app/onboarding/page.tsx:29` — wordmark repeated on auth/onboarding pages
- Page-level `metadata.title` suffixes ("— Scenes") across `mon-espace`, `artiste`, `salle`, `communaute`, `dev/*`, `shows` pages (roughly 15 files, all following the same `` `${x} — Scenes` `` pattern)

## Proposed approach
1. Grep for the exact set of user-facing occurrences: `grep -rn "Scenes\b" apps/web/app apps/web/components --include="*.tsx" --include="*.ts"` (excluding `.next` build output, which regenerates).
2. Replace each with "Scene": the wordmark in `SiteHeader.tsx`, `SplashScreen.tsx`'s `WORD` constant, and every `metadata.title` string across the app/page files listed above.
3. Leave untouched: `@scenes/db` package name/imports, `apps/web`/`apps/worker`/`packages/db` folder names, `scenes.badoz.org` / `scenes-vm` infra names, and any internal variable/table names — none are visible to end users and renaming them is unrelated churn with real cost (import paths, DNS, Coolify config).
4. Quick manual check after the change: home splash screen, site header on any page, and browser tab title, to confirm "Scene" reads correctly with no leftover plural (including apostrophe-adjacent text like "Bienvenue sur Scenes" if any exists — the grep in step 1 will catch it).

## Out of scope
- Renaming the package, repo, domain, or any internal infra name.
- Any change to the actual brand/logo asset files if they encode the word graphically (check `public/` for a logo image with baked-in text; not found in this pass, but verify before considering this done).

## Open questions / risks
- Purely mechanical text change — low risk. The one thing to double check at build time: confirm no test or snapshot elsewhere in the repo asserts on the literal string "Scenes" and would need updating too.
