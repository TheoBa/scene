# Scenes — V1

Clean restart of the Scenes platform. Self-host-first: Hetzner VPS + Coolify/Dokploy, no Supabase/Vercel.

## Docs

- `docs/scenes-knowledge-base.md` — project context, decisions, data-sourcing & legal strategy
- `docs/technical-roadmap.md` — phased plan (infra → catalogue → product → monetization)
- `docs/deployment-runbook.md` — self-hosting: Mac Mini + Cloudflare Tunnel (staging), Hetzner (prod)
- `docs/frontend-feature-inventory.md` — audit of the V0 prototype

## Structure

```
apps/web       Next.js (App Router, output: standalone) — frontend + BFF API routes
apps/worker    Node/TS — daily catalogue ingestion (OpenAgenda, DATAtourisme, France Billet)
packages/db    Shared Drizzle schema + client (Postgres)
```

## Local dev

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate && npm run db:migrate
npm run dev            # web on :3000
npm run dev:worker     # ingestion worker (or `npm run ingest -w apps/worker` for one shot)
```

## Deploy

Each app has a Dockerfile (build from repo root). On Coolify/Dokploy: one app per Dockerfile + a managed Postgres resource; set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`.
