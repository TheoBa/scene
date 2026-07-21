# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Scenes** — a social platform for live theatre in Paris. Users discover, rate, and share shows; venues and artists get their own pages. Revenue comes from ticketing affiliate links, later venue subscriptions.

This is V1, a clean restart of a vibe-coded prototype (`../scenes_V0`, Next.js + Supabase). Self-hosted by choice: no Supabase, no Vercel.

Full context lives in `docs/` — read these before making architectural suggestions:

- `docs/scenes-knowledge-base.md` — product, business model, data-sourcing & legal strategy, decision log
- `docs/technical-roadmap.md` — phased plan and what's in scope now
- `docs/deployment-runbook.md` — infrastructure, step by step
- `docs/frontend-feature-inventory.md` — audit of what V0 already built

## Architecture

```
apps/web       Next.js 16 (App Router), React 19, Tailwind 4, better-auth
               output: "standalone" for a small Docker image
apps/worker    Node/TS, node-cron — daily catalogue ingestion at 05:00 Europe/Paris
               sources: OpenAgenda, DATAtourisme, France Billet (Awin XML)
packages/db    Drizzle schema + Postgres client, shared by web and worker
```

Deliberate choices: the ingestion worker is a **separate service**, not a Next.js route, because long scheduled jobs don't belong in a web framework. A dedicated API will only be extracted when a second client (mobile app, venue portal) actually exists.

## Commands

```bash
# Local dev
docker compose up -d postgres      # Postgres only; app runs on the host
npm install
npm run db:generate                # generate Drizzle migrations from schema
npm run db:migrate                 # apply them
npm run dev                        # web on :3000
npm run dev:worker                 # ingestion worker (watch mode)
npm run ingest -w apps/worker      # run ingestion once and exit

# Full stack in Docker (closer to production)
docker compose --profile full up --build
```

## Infrastructure

| | Staging (now) | Production (later) |
|---|---|---|
| Host | Mac Mini → Lima Ubuntu VM (`scenes-vm`) | Hetzner VPS |
| Deploy | Coolify (`https://coolify.badoz.org`) | Coolify |
| URL | `https://scenes.badoz.org` | brand domain, TBD |
| Exposure | Cloudflare Tunnel | direct 80/443 |

Deploys happen by pushing to `main`; Coolify rebuilds from the Dockerfiles. In Coolify, apps use `http://` domains — Cloudflare terminates TLS, and Let's Encrypt cannot work through the tunnel.

## Git workflow

- **`main`** — release branch. Prod always serves from `main`. Only `dev` merges into it — a `dev` → `main` merge **is** a release.
- **`dev`** — long-lived integration branch. All day-to-day work lands here.
- **`feature/xxx`** — short-lived, one feature per branch. Branch from `dev`, PR back to `dev`.

Commit message format: `type(scope): description`
Common types: `feat`, `fix`, `chore`, `docs`, `infra`, `refactor`.
Examples: `feat(tick): implement daily revenue`, `fix(server): correct static file path`.

Known issue: the macOS FUSE mount used by the Linux sandbox blocks `unlink()`, so git emits `unable to unlink` warnings. These are harmless — the post-commit hook at `.git/hooks/post-commit` clears stale lock files using `mv` instead of `rm`.

**Claude is authorised to:**
- `git push origin <feature-branch>` — push feature branches to remote.
- `gh pr create` — open PRs (feature → dev).
- `gh pr merge` — merge PRs once created (squash merge preferred).

Never push directly to `main` or `dev` unless being told explicitely.
Releases (`dev` → `main`) are done by Théo. 

---

# Working with Théo

Théo is an experienced engineer but **new to most of this stack** — Next.js, Drizzle, Docker, Coolify, Cloudflare Tunnel, and Lima are all unfamiliar. Adjust accordingly.

## Never assume knowledge

Don't assume he knows a tool's conventions, default file locations, or vocabulary. When you introduce a concept, explain it in one sentence the first time. Prefer being slightly over-explicit to leaving a gap.

Don't assume something is obvious because it's standard practice. "Just add it to your env" or "point it at the workspace root" are not instructions.

## When he needs to do something manually

This is where things have gone wrong before. Every manual instruction must be complete:

1. **Say where the command runs.** This project spans four environments and they're easy to confuse:
   - macOS on the Mac Mini (prompt `theobadoz@Mac ... %`)
   - inside the Lima VM (prompt `theobadoz@lima-scenes-vm ... $`)
   - the Coolify web UI
   - his laptop
   Label every command block with its environment. Past failures were all environment mix-ups.

2. **Give exact commands, not descriptions.** Write the `sudo tee` heredoc rather than "create this file with this content". Include `sudo` where needed, and `cd` where the working directory matters.

3. **State prerequisites before the steps**, not after. If a build needs a committed lockfile, say so before he clicks Deploy.

4. **Never skip a step because it seems trivial.** Committing is not pushing. Creating a resource is not starting it. Saving is not deploying.

5. **Say what success looks like** — the exact output, page, or status that means it worked, plus what a normal-but-alarming intermediate state looks like (e.g. a 404 that's expected until a later step).

6. **For UI work, give the full click path.** "Projects → scenes → production → + New → Application", not "add an application".

## Tone and pushback

Be direct about trade-offs and disagree when warranted — he's the CTO and needs real technical judgment, not validation. Flag risks (legal, security, operational) proactively; the billetreduc scraping issue and FileVault blocking unattended reboots are the kind of thing worth raising unprompted.

When you got something wrong, say so plainly and fix it, including in the docs if the error came from there.

## Keep the docs current

`docs/` is the project's memory. When a decision is made, record it in the decision log in `scenes-knowledge-base.md`. When a runbook step turns out to be wrong or incomplete, fix the runbook — don't just fix it in chat.
