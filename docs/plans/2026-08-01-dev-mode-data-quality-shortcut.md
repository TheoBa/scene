---
note_ids: [0f0e5673-db07-4727-b2dc-f1677bf42ec7]
status: plan_done
created: 2026-08-01
---

# Dev-mode shortcut button to /dev/data-quality

## Source notes
> Permettre aux comptes whitelist d'acceder a la page data-quality a partir d'un bouton dans l'interface dev mode — idea, dropped from /dev/data-quality

## Problem / request
`/dev/data-quality` and `/dev/posters` both exist but are only reachable by
typing the URL directly — they deliberately 404 instead of redirecting for
non-whitelisted users (`apps/web/lib/dev-access.ts`'s `getDevAccess()`, checked
at `apps/web/app/dev/data-quality/page.tsx:30-33` and
`apps/web/app/dev/posters/page.tsx:16-18`). Théo wants a button, inside the
existing "dev mode" UI, that navigates there directly.

The only visible dev-mode UI today is the floating 🛠️ widget,
`apps/web/components/DevFeedback.tsx`, mounted in `apps/web/app/layout.tsx:31`
only when `getDevAccess()` returns non-null.

## Proposed approach
Extend `DevFeedback`'s open panel with a small links row above or below the
note-submission form:

- Add links to `/dev/notes` (if not already easy to reach), `/dev/data-quality`,
  and `/dev/posters` — all three are the same allowlist-gated admin surface, so
  bundling them is more useful than a single-purpose button and costs nothing
  extra to build.
- No new gating logic needed: the panel already only renders for allowlisted
  users (`layout.tsx` gates the whole `<DevFeedback />` mount), so the links
  don't need their own `getDevAccess()` check — the destination pages re-check
  server-side regardless (defense in depth already in place).
- Simple `<Link>` elements styled consistently with the existing panel (see the
  category-picker buttons in `DevFeedback.tsx` for the visual language).

## Out of scope
- Any change to how `/dev/*` pages authenticate — the allowlist/404 pattern
  stays as-is.
- A dedicated "dev mode" landing/index page — this is just links inside the
  existing widget.

## Open questions / risks
- The note only asked for `/dev/data-quality`; confirm with Théo whether
  bundling `/dev/posters` and `/dev/notes` links in is welcome or scope creep —
  low risk either way since it's a few extra lines.
