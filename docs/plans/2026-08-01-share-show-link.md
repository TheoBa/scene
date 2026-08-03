---
note_ids: [3b1c4d1b-43f6-4c31-8b3c-c73447cb0ba2]
status: implemented_pending_review
created: 2026-08-01
pr: https://github.com/TheoBa/scene/pull/53
---

# Share show link (WhatsApp / Messenger / copy link)

## Source notes
> Bouton pour partager le lien du show sur Whatsapp, Messenger, liens — idea, dropped from /shows

## Problem / request
The show page (`apps/web/app/shows/[slug]/page.tsx`) has no way to share it. Théo
wants explicit share buttons for WhatsApp, Messenger, and a copy-link action.

## Proposed approach
Add a small client component, `apps/web/components/ShareButtons.tsx`, rendered on
the show page near the ticket/official-site links (after the `SourceAttribution`
block around `apps/web/app/shows/[slug]/page.tsx:133`).

- Computes the canonical show URL client-side (`window.location.href` — the page
  is already server-rendered per-slug, so this is always correct) and uses
  `show.name` for the share text.
- **WhatsApp**: `https://wa.me/?text=${encodeURIComponent(text + " " + url)}` in a
  new tab — no API needed, works on desktop (opens WhatsApp Web) and mobile.
- **Messenger**: `https://www.facebook.com/dialog/send?link=${url}&app_id=<FB_APP_ID>&redirect_uri=${url}`
  — Messenger's share dialog requires a registered Facebook App ID. Note this as
  a blocker below rather than guessing an ID.
- **Copy link**: `navigator.clipboard.writeText(url)` with a small "Copié !"
  confirmation state (same pattern as any other transient-confirmation UI in this
  codebase, e.g. `DevFeedback`'s `done` state).
- Optionally, on platforms where `navigator.share` exists (most mobile browsers),
  show a single native "Partager" button instead of the three explicit ones —
  covers WhatsApp/Messenger/anything else installed with zero per-target code.
  This is an enhancement, not required to satisfy the note.

No schema or API changes; this is presentational only.

## Out of scope
- Instagram story sharing (separate note, dropped per Théo — "let's forget this
  one").
- Server-side share/click analytics.

## Open questions / risks
- **Messenger's share dialog needs a Facebook App ID** registered in Meta's
  developer console — that's a manual setup step outside this codebase. If
  that's too much ceremony for now, drop the explicit Messenger button and rely
  on `navigator.share` (which already lists Messenger as a target on devices
  where the app is installed) — flag this trade-off to Théo before building.
- Decide during implementation whether to lead with `navigator.share` (simpler,
  fewer explicit brand buttons) or the three explicit buttons the note literally
  asked for.
