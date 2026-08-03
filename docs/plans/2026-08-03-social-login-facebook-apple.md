---
note_ids: ["6fd84269-7343-46cf-b698-16446982e124"]
status: plan_done
created: 2026-08-03
---

# Social login: add Facebook and Apple

## Source notes
> Parcours utilisateur: `know your customer` - Permettre a un utilisateur de se connecter via Google / Insta / Facebook avec confirmation par email. — idea, dropped from /shows

## Problem / request
Google login already works (`apps/web/lib/auth.ts`). Instagram doesn't offer a general-purpose consumer login OAuth flow (it's Facebook Login under the hood, gated to business/creator use cases), so it was dropped from scope. Théo chose **Facebook + Apple** as the two providers to add when asked which ones the plan should actually cover.

## Proposed approach
1. **better-auth config** (`apps/web/lib/auth.ts`): mirror the existing conditional `google` pattern for `facebook` and `apple`:
   ```ts
   const facebook =
     process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
       ? { facebook: { clientId: ..., clientSecret: ... } }
       : undefined;
   const apple =
     process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
       ? { apple: { clientId: ..., clientSecret: ... } }
       : undefined;
   ```
   Merge all three into `socialProviders: { ...google, ...facebook, ...apple }` (today `socialProviders: google` only works because `google` is either `{ google: {...} }` or `undefined`, which better-auth accepts as an empty object of providers — verify this still holds once merging three).
2. **Client** (`apps/web/lib/auth-client.ts`): export `facebookEnabled` / `appleEnabled` flags alongside the existing `googleEnabled`, following whatever pattern that file already uses to expose `googleEnabled` to the client (likely a build-time env check — read the file before implementing).
3. **UI** (`apps/web/components/AuthForm.tsx`): add "Continuer avec Facebook" / "Continuer avec Apple" buttons next to the existing Google one, gated on their respective `*Enabled` flags, calling `signIn.social({ provider: "facebook" | "apple", callbackURL: "/onboarding" })`.
4. **Credentials setup (Théo, manual, not code)**: register OAuth apps with Meta for Developers (Facebook Login product) and Apple's Sign in with Apple (needs an Apple Developer account, a Services ID, and a private key for the client secret JWT — Apple's client "secret" is a signed JWT that expires and needs periodic regeneration, unlike Google/Facebook's static secret). Document the exact steps in `docs/deployment-runbook.md` once implemented, and set `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`/`APPLE_CLIENT_ID`/`APPLE_CLIENT_SECRET` in Coolify.
5. Email verification: both providers return a provider-verified email in the OAuth flow; better-auth trusts that by default the same way it already does for Google, so no extra "confirm by email" step is needed beyond what's already in place.

## Out of scope
- Instagram login (not a viable consumer OAuth flow).
- Any change to the existing email/password or Google flow.

## Open questions / risks
- Apple's client-secret-as-JWT needs regenerating periodically (expires up to 6 months) — worth a calendar reminder once live, or automating regeneration; flag in the runbook.
- Confirm `apps/web/lib/auth-client.ts`'s actual mechanism for `googleEnabled` before copying the pattern for the other two (not yet read in this planning pass).
