---
name: staging-db-enrichment
description: Run something against the live staging Postgres (Coolify, behind a temporary public-exposure toggle) — applying pending Drizzle migrations, running a one-off backfill/enrichment script (e.g. venue geocoding, artist photo/social enrichment), or an ad-hoc read-only query (e.g. "how many venues have lat/lng on staging", "which artists are still missing photos"). Use when Théo says something like "run it on staging", "check staging for X", "migrate staging", or asks a question that can only be answered by the real staging data, not local dev data. Handles the temporary-public-DB dance from docs/deployment-runbook.md §S5, including reminding Théo to turn exposure back off — never skip that step.
user-invocable: true
---

# staging-db-enrichment — migrate, backfill, or query the live staging Postgres

Staging Postgres runs on Coolify's internal Docker network — it isn't reachable
from the Mac Mini by default, and the web app's runtime image doesn't carry
`drizzle-kit` or a `psql` client anyway. The only way to touch it directly is a
**temporary** public-exposure toggle in the Coolify UI, then a real connection
from the Mac. This skill is that whole dance, generalized to whatever the actual
task is (migrate, run a named backfill script, or run a read-only query) —
detailed step-by-step precedent for this exact flow is in
`docs/deployment-runbook.md` §S5/§S5a; this skill exists so future runs don't
need to be walked through it from scratch.

**This machine must be the Mac Mini** (`hostname` → something like
`Mac.ht.home`) — staging Postgres is only reachable from there (via Lima's port
forwarding), not from a sandboxed/remote environment. If you're not on the Mac
Mini, stop and say so.

## 0. Figure out what's actually being asked

Before touching anything, work out which of these (possibly more than one) the
task needs:
- **Migrate**: apply pending Drizzle migrations (`npm run db:migrate`) — needed
  whenever a merged PR added a migration file under `packages/db/migrations/`
  that staging hasn't seen yet.
- **Backfill/enrichment script**: run a specific `npm run backfill-* -w
  packages/db` script (check `packages/db/package.json` for the exact name —
  don't guess it).
- **Read-only query**: answer a question about the real staging data via
  `psql "$DATABASE_URL" -c "..."` — no writes, just reporting. This is the
  "venue-related information" use case: coverage counts, spot-checking specific
  rows, etc.

Migrations and backfills are usually paired (migrate first, since a backfill
script typically depends on a column the migration just added) — but a query-only
ask needs neither.

## 1. Check whether the DB is already exposed

```bash
nc -zv -G 3 127.0.0.1 5433
```
`succeeded` means someone already toggled it on (maybe from an earlier step in
the same session) — skip to step 3. `refused`/timeout means step 2 is needed.

## 2. Ask Théo to expose it (Coolify UI — cannot be automated)

Tell him, in the terminal, exactly this — a real toggle in a real UI, not
something this skill can click for him:

> On your laptop, browser: go to `https://coolify.badoz.org` → open the
> `scenes` project → **production** environment → the **PostgreSQL** resource →
> toggle **"Make it publicly available"** to **ON** → set the public port to
> **`5433`** (not 5432 — that's local dev Postgres via Lima) → **Save**. Let me
> know once that's done.

Wait for his confirmation, then re-run the `nc` check from step 1 before
proceeding — don't assume the toggle succeeded.

## 3. Connect

```bash
cd /path/to/scene   # repo root
cat .env.staging     # gitignored; should already exist from a prior run
```
If `.env.staging` is missing, build it from the resource's connection string
(visible in the Coolify UI on the same PostgreSQL resource page, even before
toggling public — it's just the internal one; only the host/port differ once
exposed):
```bash
cat > .env.staging <<'EOF'
DATABASE_URL="postgres://postgres:<pw>@127.0.0.1:5433/postgres"
EOF
```
Never print `.env.staging`'s contents (or `$DATABASE_URL`) into a report back to
the user or into a committed file — it holds the DB password.

```bash
set -a; . ./.env.staging; set +a
psql "$DATABASE_URL" -c "select 1;"   # sanity check before anything else
```

## 4. Do the actual work

- **Migrate**: `npm run db:migrate`, expect `migrations applied successfully!`.
  If it fails, drizzle-kit often hides the real cause — try a direct `psql`
  connect to see the actual error (auth / db name / SSL; append
  `?sslmode=disable` to the URL if SSL is the problem).
- **Backfill/enrichment**: `npm run <script-name> -w packages/db`, same as
  running it locally. Read its own summary log line for counts.
- **Query**: plain `psql "$DATABASE_URL" -c "..."`, read-only. If a question
  needs a write to answer (it shouldn't), stop and confirm with Théo first —
  this is real production-adjacent data, not a throwaway dev DB.

Verify with a follow-up query appropriate to the task (row counts, a `NULL`
check, spot-checking a couple of specific rows by name/id) — don't just trust
the command's exit code, per the same standard used for local verification.

## 5. Close the exposure — mandatory, every time

Even for a query-only run. Tell Théo:

> Back in the Coolify UI: same PostgreSQL resource → toggle **"Make it publicly
> available"** back to **OFF** → **Save**.

Don't consider the task done until this step has been requested — a
public-facing Postgres with a real password is a live exposure for as long as
it's left on, independent of whether this skill's own work is finished.

## 6. Report back

Short summary: what ran, the actual counts/output (not the connection string),
and an explicit line confirming you've asked Théo to toggle exposure back off.
