# Plans

Implementation plans written by the `plan-from-notes` Claude Code skill
(`.claude/skills/plan-from-notes/`), one file per dev-notes cluster it judged
ready to plan. Each file's frontmatter lists the `dev_notes` row IDs it came
from (`note_ids: []` for hand-written plans not tied to a dev-notes row) — see
the skill for the exact shape.

`status: plan_done` means ready to build but not yet started. The
`implement-plan` skill (`.claude/skills/implement-plan/`) builds a plan, opens
a PR into `dev`, and flips its `status` to `implemented_pending_review` once
that PR is open. `status: done` is set manually by Théo after validating the
change live — no skill sets that.
