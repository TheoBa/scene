# scenes_V0 — Frontend Feature Inventory

> Audit of the vibe-coded prototype (`scenes_project/scenes_V0/`, package name `theatres-v2`), 2026-07-18.
> Purpose: know what exists, decide what to rebuild in V1 and in what order.

## Stack (V0)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (auth + Postgres + edge functions) · Leaflet / react-leaflet (maps) · next-pwa (PWA) · Resend (transactional email) · Syne font · lucide-react icons.

## Pages / routes

| Route | Feature |
|-------|---------|
| `/` | Home: Leaflet map + Sidebar + DetailPanel; switchable panels: Planificateur ("Choisir ma scène"), À la une (featured), Membres, Critiques |
| `/carte` | Dedicated map page |
| `/piece/[id]` | Piece detail page — desktop "Odéon" layout, synopsis toggle, hero mini-map, members tab, client actions, mobile "bonheur" actions |
| `/artiste` | Artist page + piece proposal form (artist mode on profiles) |
| `/carnet/[notebookId]` | Carnet (notebook) detail — lists of pieces |
| `/membres/carnet` | Shared carnets between members |
| `/mes-pieces` | User's pieces, category filters, "déjà vu" (seen it) modal |
| `/mon-compte` | Account management |
| `/trophees` | Trophies / gamification |
| `/invite/[token]` | Invitation flow |
| `/(auth)/login`, `/auth/callback`, `/complete-profile` | Auth flow (Supabase), profile completion |
| `/contact` | Contact page |
| `/api/welcome-email` | Welcome email (Resend) |

## Feature areas (by component)

**Discovery & map**
- Interactive Leaflet map of Paris theatres (`Map`, `MapWrapper`, geocoded `salles`)
- Sidebar listing + `DetailPanel` for selected piece/venue
- `Planificateur` — "choose my show" planning flow
- `ALaUne` — featured/editorial highlights
- Category filters (`MesPiecesCategoryFilters`)

**Piece experience**
- Piece modal (`ModalePiece`) + full page with dedicated desktop layout
- Synopsis toggle, hero mini-map
- Reservation modal (`ModaleReservation`) — ticketing redirect
- Share piece modal (`SharePieceModal`)
- "Déjà vu" marking (`ModaleDejaVu`)
- Piece editor modal (`PieceEditorModal`), artist piece-proposal form

**Social**
- Friendships, members panel (`MembresPanel`, `PieceMembresTabPanel`)
- Carnets: personal + shared notebooks (`CarnetListsView`, `MembresSharedCarnetView`, `AddToSharedNotebooksModal`, `ModaleCarnetPartage`, `SharedNotebookDetailHero`)
- Activity feed (table `activity_feed`)
- Critiques (reviews) panel
- Invitations by token

**Gamification / engagement**
- Trophies page, `ModalePorteParadis`, survey modal (`ModaleSondage`)

**Auth & account**
- Supabase auth (login, callback, complete-profile), account page, delete-account edge function
- Artist mode on profiles

**App shell / polish**
- PWA (installable, update banner), splash screen, landscape lock overlay, legal footer, banner image modal, read-text modal

## Backend (V0, minimal)

- Supabase migrations: `salles`/`scenes` (Paris venues + pieces, geocoded), `profiles` (username, artist_mode), notebooks schema + member write policies, carnet-partagé activity, pieces upsert
- Data: manually scraped (billetreduc) — **to be replaced** (see knowledge base §7)
- Script: `geocode-theatres.ts`
- Edge function: `delete-account`

## Notable V0 tables

`scenes`, `salles`, `profiles`, `notebooks`, `notebook_items`, `notebook_members`, `friendships`, `invitations`, `activity_feed`, `scenes_proposees`.

## Gaps vs. product vision (candidate V1 priorities)

- No Explorer / recommendation engine (taste-based reco)
- No follow-influencer model (only friendships)
- No ratings system distinct from critiques
- No venue-managed pages (venue role absent)
- Artist pages embryonic (single `/artiste` page + proposal form)
- No affiliate tracking on ticketing redirects
- No ingestion pipeline (data is manually scraped/seeded)
- Search: not identified as a dedicated feature
