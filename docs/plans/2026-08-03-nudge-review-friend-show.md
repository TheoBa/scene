---
note_ids: ["e1c033d2-fc85-4c59-8e28-df091a3798ab"]
status: plan_done
created: 2026-08-03
---

# Nudge to review a show a friend has reviewed

## Source notes
> Incentive a utiliser l'app: Inciter a aussi donner son avis sur la piece d'un ami — idea, dropped from /communaute

## Problem / request
When a friend posts a review in the `/communaute` feed, there's currently no prompt encouraging the viewer to add their own review of that same show if they've also seen it. This is a distinct, concrete feature from the profile-completion-gauge cluster (see `2026-08-03-profile-completion-gauge.md`) — it's about a specific in-feed nudge, not general profile richness.

## Proposed approach
1. **Query** (`apps/web/lib/community.ts`, extend `getFeed`): for each feed item, also check whether the viewer has `attendance` for that `eventId` but no `comments` row yet. Add a `viewerHasReviewed: boolean` and `viewerHasAttended: boolean` field to `FeedItem`.
2. **UI** (`apps/web/app/communaute/page.tsx`): when `viewerHasAttended && !viewerHasReviewed`, render a small inline CTA on that feed card — "Toi aussi tu l'as vu ? Donne ton avis →" linking to the show page's review form (`/shows/[slug]`).
3. When the viewer hasn't marked the show as seen at all, skip the CTA — don't ask someone to review a show they haven't attended (encourages faking).
4. No new DB tables — this is purely a join against the existing `attendance` and `comments` tables already used in `getFeed`.

## Out of scope
- Push/email notifications for this nudge — feed-only for v1.
- Nudging on shows the viewer hasn't attended (deliberately excluded, see above).

## Open questions / risks
- None — this is a small, self-contained addition to an existing query and page.
