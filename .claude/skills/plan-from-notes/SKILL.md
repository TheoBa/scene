---
name: plan-from-notes
description: On-demand triage of the Scenes dev-notes backlog (ideas, bugs, and other feedback dropped from the live site's ⌘I widget, stored in dev_notes). Fetches every untackled/waiting_for_input note over the /api/dev/notes HTTP API, groups related ones, and for each group either asks the user (Théo) the specific missing questions via AskUserQuestion when there isn't enough to plan from, or writes a feature/fix implementation plan to docs/plans/ when there is — flipping each note's status accordingly (waiting_for_input or plan_done) so /dev/notes reflects where every item stands. Use when Théo says something like "run plan-from-notes", "process the backlog", "plan the dev notes", or "what's in the notes queue". Does not implement anything — planning only.
user-invocable: true
---

# plan-from-notes — turn the dev-notes backlog into reviewable plans

Scenes' live site has a feedback widget (⌘I) that lets Théo and his cofounder drop
free-text notes (category `bug` | `idea` | `other`) while browsing. They land in
Postgres's `dev_notes` table with `status: untackled`. This skill is the on-demand
first stage of turning that backlog into work: group related notes, decide per
group whether there's enough to plan from, and either ask for what's missing or
write the plan. A **separate**, not-yet-built "build from plan" skill is
responsible for actually implementing a `plan_done` note later — this skill never
writes application code.

Full status vocabulary (`apps/web/lib/dev-notes.ts`, `DEV_NOTE_STATUSES`):
`untackled` → `waiting_for_input` | `plan_done` → `implemented_pending_review` → `done`.
This skill only ever sets the first two; `implemented_pending_review` and `done`
belong to later stages.

## 0. Get API access

Reads/writes go through `/api/dev/notes`, not the database directly — the DB is
not normally reachable from outside the Coolify host. Look for a gitignored
`.env.dev-notes` file at the repo root:

```
DEV_NOTES_API_URL=https://scenes.badoz.org
DEV_NOTES_API_TOKEN=<the token>
```

If it's missing, stop and tell Théo (in the terminal running Claude Code, on his
Mac Mini) to create it:

```bash
cd /path/to/scene
cat > .env.dev-notes <<'EOF'
DEV_NOTES_API_URL=https://scenes.badoz.org
DEV_NOTES_API_TOKEN=<value of DEV_NOTES_API_TOKEN set on the web app in Coolify>
EOF
```

If `DEV_NOTES_API_TOKEN` has never been set in Coolify, that's also a
prerequisite — see `docs/deployment-runbook.md` §S7 (one-time setup: generate a
token, set it in Coolify on the web app resource, redeploy, then write the same
token into `.env.dev-notes` as above). Without it the route always 404/401s.

## 1. Fetch the backlog

```bash
set -a; . ./.env.dev-notes; set +a
curl -s -H "Authorization: Bearer $DEV_NOTES_API_TOKEN" "$DEV_NOTES_API_URL/api/dev/notes"
```

Filter the returned `notes` array to `status` in `untackled` or `waiting_for_input`
— the latter are re-tried every run in case Théo now has an answer.
`plan_done` / `implemented_pending_review` / `done` notes are out of scope; ignore
them (don't re-plan or touch their status). An empty filtered list means nothing
to do — say so and stop.

## 2. Group related notes

Cluster by judgment, not a fixed rule: same feature area or page (`path`),
overlapping subject matter, or one note that's clearly a follow-up/duplicate of
another. A cluster can be a single note. Bugs, ideas, and "other" all go through
the same pipeline — don't filter by `category`. Note the clustering in your final
report so Théo can see how you grouped things.

## 3. Per cluster: enough to plan, or not?

Read the note bodies, their `path`s, and skim the relevant part of the codebase
(the feature they're about) before judging — often the code answers what the note
doesn't. A cluster has **enough** when you could hand the plan to an engineer
unfamiliar with the request and they'd know what to build and roughly how to
verify it's done. Missing concrete specifics (which filters, what the exact
copy/behavior should be, which of several plausible interpretations is meant,
whether it's in scope for V1 per `docs/technical-roadmap.md`) means **not enough**.

### Not enough → ask and mark waiting

1. `PATCH` every note in the cluster to `waiting_for_input`:
   ```bash
   curl -s -X PATCH -H "Authorization: Bearer $DEV_NOTES_API_TOKEN" \
     -H "Content-Type: application/json" -d '{"status":"waiting_for_input"}' \
     "$DEV_NOTES_API_URL/api/dev/notes/<id>"
   ```
2. Ask the specific missing question(s) with `AskUserQuestion` — concrete,
   answerable questions tied to this cluster, not "tell me more". Batch questions
   from multiple under-specified clusters into as few `AskUserQuestion` calls as
   the 4-question limit allows.
3. If Théo answers: treat the cluster as now-sufficient and continue to the
   "Enough" path below in the same run (don't leave it stuck at
   `waiting_for_input` once it's actually been answered).

### Enough → write the plan

1. Investigate the relevant code (the app's actual structure, not assumptions —
   this repo's own `CLAUDE.md` has the architecture and conventions) so the plan
   is grounded, not generic.
2. Write `docs/plans/<YYYY-MM-DD>-<slug>.md`:
   ```markdown
   ---
   note_ids: [<uuid>, <uuid>, ...]
   status: plan_done
   created: <YYYY-MM-DD>
   ---

   # <short title>

   ## Source notes
   > <verbatim note body> — <category>, dropped from <path or "unknown page">

   (repeat per note in the cluster)

   ## Problem / request
   What's being asked for and why, in your own words.

   ## Proposed approach
   The implementation plan — concrete enough for a "build from plan" pass or a
   human to execute directly: which files change, new files needed, schema/API
   changes, sequencing if multi-step.

   ## Out of scope
   What this plan deliberately doesn't cover.

   ## Open questions / risks
   Anything a reviewer should double check before building.
   ```
   The `note_ids` frontmatter is what lets a future dashboard join a `dev_notes`
   row to its plan file — always include it, exactly matching the IDs you're
   about to mark `plan_done`.
3. `PATCH` every note in the cluster to `plan_done` (same curl shape as above,
   `{"status":"plan_done"}`).

## 4. Report back

A short summary, not a re-narrative: how many clusters, per cluster its notes and
outcome (✅ plan written at `docs/plans/...`, or ⏳ waiting on Théo's answer to
`<question>`), and anything you deliberately left `untackled` (not actionable,
duplicate, unclear enough to even ask about — flag these for manual triage/deletion
at `/dev/notes` rather than silently changing their status).
