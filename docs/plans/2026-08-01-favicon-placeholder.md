---
note_ids: [1dd1f0f5-1975-495f-ad0b-b0d2423be00d]
status: implemented_pending_review
created: 2026-08-01
pr: https://github.com/TheoBa/scene/pull/44
---

# Browser-tab favicon (placeholder monogram)

## Source notes
> Ajout d'un logo sur le tab du browser — idea, dropped from /shows/dernier-coup-de-ciseaux

## Problem / request
There's no favicon at all today — `apps/web/app/layout.tsx`'s `metadata` export
(lines 15-19) has no `icons` key, and no `favicon.ico`/`icon.png`/`icon.tsx`
exists under `apps/web/app`. Confirmed with Théo: no real logo asset exists yet
either (`apps/web/public/` only has `poster-default.svg`, a poster-fallback
placeholder, not branding) — ship a simple placeholder monogram now rather than
wait on real branding.

## Proposed approach
Next.js App Router auto-detects `apps/web/app/icon.tsx` (or `icon.png`) and
wires it into `<head>` without touching `metadata.icons` by hand — the
lightest-weight route.

- Add `apps/web/app/icon.tsx` using Next's built-in `ImageResponse`
  (`next/og`, no new dependency — same primitive OG-image routes use):
  ```tsx
  import { ImageResponse } from "next/og";

  export const size = { width: 32, height: 32 };
  export const contentType = "image/png";

  export default function Icon() {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 22,
            background: "var(--accent)", // resolve to the actual hex — CSS vars
                                          // don't work inside ImageResponse
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
          }}
        >
          S
        </div>
      ),
      size,
    );
  }
  ```
- Pull the `--accent` value from `apps/web/app/globals.css` and hardcode the
  hex (CSS custom properties aren't available inside `ImageResponse`'s JSX).
- Use the Syne font family already loaded for the "S" if `ImageResponse` can
  load it easily; falling back to a default sans-serif is fine for a
  placeholder — don't block on font-loading plumbing for this.

## Out of scope
- Real logo design — this is explicitly a stand-in until Théo has branding.
- `apple-touch-icon`, PWA manifest icons, or other icon sizes — a single 32×32
  favicon satisfies the note ("logo sur le tab du browser").

## Open questions / risks
- None blocking — this is intentionally the smallest possible version. Revisit
  once real branding exists (swap `icon.tsx` for a static `icon.png`/`icon.svg`
  export of the real mark).
