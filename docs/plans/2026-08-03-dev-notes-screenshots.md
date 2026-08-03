---
note_ids: ["bc739b2a-3648-41af-9bfb-79ffa53b1212"]
status: implemented_pending_review
created: 2026-08-03
pr: https://github.com/TheoBa/scene/pull/60
---

# Screenshots in dev-notes

## Source notes
> Ajouter des captures d'ecran dans les notes du dev-mode (pour passer un support visuel quand necessaire) — idea, dropped from /dev/notes

## Problem / request
The ⌘I feedback widget (`apps/web/components/DevFeedback.tsx`) is text-only. Théo/his cofounder want to attach a screenshot to a note when a bug or idea is easier to show than describe.

## Proposed approach
1. **Capture**: add `html2canvas` (new dependency — no screenshot API exists in-browser without one) to `apps/web`. In `DevFeedback.tsx`, add a "📸 Joindre une capture" button that, on click, briefly hides the widget panel itself, runs `html2canvas(document.body)`, and re-shows the panel with a thumbnail preview of the captured image plus a "Retirer" option to clear it.
2. **Storage**: `dev_notes` has no attachment column. Given this is an admin-only, low-volume, internal tool (not user-facing content), avoid standing up new object-storage infra (no S3/R2 in this project today) — add a nullable `screenshotDataUrl: text` column to `devNotes` storing the PNG as a base64 data URL directly. Cap the captured canvas size (e.g. downscale to max 1280px wide via canvas before encoding) to keep row size reasonable.
3. **Submit path**: extend `submitDevNote` (`apps/web/app/dev/actions.ts`) and its Zod/validation input to accept an optional `screenshotDataUrl`, and the insert in the dev-notes write path to store it.
4. **Display**: on `/dev/notes` (`apps/web/app/dev/notes/page.tsx`), render a thumbnail (clickable to open full-size, e.g. in a new tab via the data URL directly) next to any note that has one.
5. **API**: `/api/dev/notes` (used by the `plan-from-notes` skill) should include `screenshotDataUrl` in its response so a future triage pass can reference "see attached screenshot" — but this skill's own workflow doesn't need to render it, just not silently drop the field.

## Out of scope
- Any screenshot capability for regular (non-dev-mode) users.
- Annotating/drawing on the screenshot before submit — plain capture only for v1.
- Real object storage (S3/R2) — revisit only if data-URL row sizes become a problem in practice.

## Open questions / risks
- `html2canvas` can't capture content in cross-origin iframes or some CSS effects (backdrop-blur, certain gradients) perfectly — acceptable for a bug-report screenshot, not pixel-perfect. Confirm that's fine for the use case (it should be, per the note's own framing "quand necessaire").
- Base-64-in-Postgres is the pragmatic call for this tool's actual scale (two users); flag to Théo that this wouldn't be the right call if screenshots were ever user-facing/high-volume.
