---
name: implement-plan
description: Build a plan from docs/plans/ (written by the plan-from-notes skill or by hand) into real code, then open a PR into dev. Follows the repo's mandatory feature-branch workflow, and once the PR is open, flips the plan's own frontmatter status and any linked dev_notes rows to implemented_pending_review so /dev/notes reflects that it's built and awaiting Théo's live-review sign-off — Théo alone moves things to done. Supports batch mode: launch multiple plans at once, each in its own git worktree/branch, in parallel. Use when Théo says something like "implement this plan", "build docs/plans/<file>", "implement the dark-mode plan", or "batch implement all the plans I've queued up". Does not merge PRs or mark anything done — that's Théo's call after validating on staging/live.
user-invocable: true
---

# implement-plan — turn a docs/plans/ file into a merged-ready PR

This is the second stage after `plan-from-notes` (or a hand-written plan dropped
into `docs/plans/`): take a `status: plan_done` plan file, actually build it, and
open a PR. It never merges, and it never sets a note or a plan to `done` — only
Théo does that, after checking the change live per his usual review flow.

## 0. Pick which plan(s) to implement

- If Théo names a specific plan (path, slug, or description matching one), use
  that single file.
- If he asks to batch/implement everything queued up, scan `docs/plans/*.md`
  (skip `README.md`) and read each file's frontmatter. Candidates are every file
  with `status: plan_done`. Files already at `implemented_pending_review` or
  `done` are finished with this stage — skip them, don't re-implement.
- If nothing qualifies, say so and stop.

## 1. Single-plan implementation

Repeat this whole section per plan, whether it's the one plan Théo named or one
of several in a batch.

### 1.1 Branch first — non-negotiable

Per this repo's `CLAUDE.md`: cut `feature/<slug>` off `dev` **before** the first
commit, never commit on `dev` directly. Use the plan file's own slug (the part of
its filename after the date) for the branch name, e.g.
`docs/plans/2026-08-03-dark-mode.md` → `feature/dark-mode`.

```bash
git checkout dev
git pull
git checkout -b feature/<slug>
```

If you're implementing more than one plan in the same run (batch mode), **each
plan needs an isolated working copy** — you cannot have two feature branches
checked out in the same working directory at once. See §3.

### 1.2 Read the plan fully before touching code

Read the whole file, not just "Proposed approach": `Out of scope` tells you
what NOT to build, `Open questions / risks` may contain a blocker worth checking
with Théo before writing code (use `AskUserQuestion` if a risk is genuinely
blocking; otherwise make the reasonable call and note it in the PR description).
Also read the `Source notes` section — it's the verbatim ask, useful when the
proposed approach is ambiguous.

### 1.3 Implement

Follow "Proposed approach" as the plan for the change. Investigate the actual
current code as you go rather than trusting the plan's file/line references
blindly — plans can be a few days stale by the time they're built. This repo's
root `CLAUDE.md` has the architecture, conventions, and commands
(`npm run db:generate`, etc.) — use them.

### 1.4 Verify before committing

- Run `npm run build -w apps/web` (or the relevant workspace) — per
  [[scenes-verify-next-build]], `tsc`/lint alone miss client-bundle errors that
  only a full `next build` catches.
- If the plan touches the worker or DB schema, run the relevant
  `npm run db:generate` / `db:migrate` / worker command locally.
- For UI-visible changes, use the `run` or `verify` skill to actually see the
  feature working before opening the PR — don't just claim it works.

### 1.5 Commit and push

Commit message format `type(scope): description` (see root `CLAUDE.md`). Push
the feature branch — this is pre-authorized, no need to ask:

```bash
git push origin feature/<slug>
```

### 1.6 Open the PR

```bash
gh pr create --base dev --title "<type(scope): description>" --body "$(cat <<'EOF'
Implements docs/plans/<file>.md.

<one-paragraph summary of what changed and why>

Source note(s): <verbatim note body(ies) from the plan's "Source notes"
section, or "none — hand-written plan" if note_ids was empty>

<any open questions/risks from the plan you resolved or deliberately deferred>
EOF
)"
```

Opening the PR is pre-authorized per root `CLAUDE.md`. **Do not `gh pr merge`
as part of this skill** — even though CLAUDE.md lists merging as something
Claude is generally authorised to do, this flow's whole point is that
Théo reviews and validates live before anything lands on `dev`. Stop after
opening the PR.

### 1.7 Flip statuses now that the PR is open

Two separate updates, both to `implemented_pending_review` — do both:

**a) The plan file itself.** Edit its frontmatter:

```yaml
status: implemented_pending_review
pr: <PR URL from the gh pr create output>
```

This is the only record for plans with `note_ids: []` (hand-written, not from
the dev-notes backlog), so don't skip it even when there's no note to update.

**b) Any linked dev_notes rows.** If the plan's frontmatter `note_ids` is
non-empty, PATCH each one through the same API the `plan-from-notes` skill
uses — read that skill's "0. Get API access" section for the `.env.dev-notes`
prerequisite (gitignored file with `DEV_NOTES_API_URL` / `DEV_NOTES_API_TOKEN`;
if missing, stop and tell Théo how to create it, exactly as that skill
describes).

```bash
set -a; . ./.env.dev-notes; set +a
curl -s -X PATCH -H "Authorization: Bearer $DEV_NOTES_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"implemented_pending_review"}' \
  "$DEV_NOTES_API_URL/api/dev/notes/<id>"
```

Repeat per id in `note_ids`. If `note_ids` is `[]`, there's nothing to PATCH —
step (a) alone is enough.

## 2. Report back

Per plan: which file, the branch name, the PR URL, and a one-line summary of
what was built. If you deferred an open question or risk instead of resolving
it, say so explicitly so Théo knows to check it during review.

## 3. Batch mode — implementing several plans at once

Théo's stated workflow is to write several plans via `plan-from-notes`, then
batch-implement all of them. Since each plan needs its own branch and the repo
can only have one branch checked out at a time in this working directory,
**don't** try to do plans one after another by checking branches in and out of
the same worktree — implementations can conflict or you'll lose track of which
diff belongs to which plan.

Instead, launch one `Agent` call per plan, **in the same message so they run in
parallel**, each with `isolation: "worktree"` so it gets its own git worktree
and branch:

- `subagent_type`: `claude` (general-purpose is also fine)
- `isolation`: `"worktree"`
- `prompt`: point it at exactly one plan file and tell it to run §1 of this
  skill (branch → implement → verify → commit → push → PR → flip statuses)
  for that plan only, then report back the PR URL

Do not run the whole batch sequentially in the main session — that's what the
worktree isolation is for. After all agents finish, collect their PR URLs into
one summary for Théo (§2) rather than each agent reporting separately.
