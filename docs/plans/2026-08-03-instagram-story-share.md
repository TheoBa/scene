---
note_ids: ["51b7f284-15b9-48bc-b054-df5501aa8467"]
status: implemented_pending_review
pr: https://github.com/TheoBa/scene/pull/63
created: 2026-08-03
---

# Instagram Story share button

## Source notes
> Bouton pour partager un avis en story sur instagram — idea, dropped from /shows

## Problem / request
`apps/web/components/ShareButtons.tsx` (built for the earlier "share on WhatsApp/Messenger + copy link" note, already merged in #53) covers native share, WhatsApp, and copy-link, but not Instagram Stories specifically. Instagram Stories sharing is technically different from a plain link share: Instagram doesn't accept a URL+text payload the way WhatsApp does — it requires either a native mobile intent with an image on the clipboard/pasteboard, or (on iOS Safari) a specific URL scheme with a background image sticker.

## Proposed approach
1. **Generate a shareable image**: reuse or extend the existing poster (`show.imageUrl` via `posterSrc`) as the Story background. If a plain poster crop isn't visually enough, generate a purpose-built share card (show poster + title + the reviewer's reaction emoji) via a Canvas-based renderer (client-side, since this only needs to run on click) or a server-rendered OG-image-style route (`/shows/[slug]/opengraph-image` pattern Next.js already supports) reused for this purpose.
2. **Trigger**: on mobile Safari/iOS, Instagram supports `instagram-stories://share?source_application=<facebook_app_id>` with the image passed via `UIPasteboard` — this requires a registered Facebook/Meta App ID (same prerequisite noted in `ShareButtons.tsx`'s existing comment about why there's no explicit Messenger button today). On Android, an intent URL (`intent://share#Intent;package=com.instagram.android;...`) with the image shared via the Web Share API's `files` support (`navigator.share({ files: [...] })`) is the more reliable modern path and doesn't need an App ID.
3. **Add the button** to `ShareButtons.tsx`: "Partager en story" — prefer the Web Share API `files` path (Android + some desktop browsers) as the primary mechanism since it needs no App ID; treat the iOS pasteboard/URL-scheme path as a stretch addition once the App ID exists.
4. **Desktop fallback**: Instagram Stories has no desktop web equivalent — hide the button entirely when `navigator.share` with `files` support isn't available (feature-detect, matching the existing `canNativeShare` pattern in the file) rather than showing a broken button.

## Out of scope
- Registering a Meta/Facebook App ID (a prerequisite for the iOS pasteboard path) — flag to Théo as a manual step if that path is wanted; ship the Android/Web-Share-API path first without it.
- Instagram feed post sharing (as opposed to Stories) — not requested.

## Open questions / risks
- Confirm what image should actually appear in the Story: a plain poster crop is fastest to ship; a custom share card (poster + title + reaction) is more on-brand but is meaningfully more work (a new image-generation route) — recommend shipping the plain poster first and upgrading later.
- Without a Meta App ID, this only reliably works on Android via the Web Share API — iOS support is a stretch goal pending that registration.
