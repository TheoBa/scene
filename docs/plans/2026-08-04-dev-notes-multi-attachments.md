---
note_ids: ["bc739b2a-3648-41af-9bfb-79ffa53b1212"]
status: implemented_pending_review
created: 2026-08-04
supersedes: docs/plans/2026-08-03-dev-notes-screenshots.md
---

# Multi-document attachments in dev-notes

## Source
Direct correction from Théo, live in conversation: the original screenshots
plan (`2026-08-03-dev-notes-screenshots.md`) auto-captured the current page
via html2canvas. That's not what was asked — Théo wants to attach one or more
*existing* documents (often a screenshot taken elsewhere, e.g. macOS's own
screenshot tool, but also PDFs/other files) to a note.

## What changed
1. **Removed** the html2canvas-pro auto-capture entirely (button, dependency,
   `screenshotDataUrl` column).
2. **Added** a real multi-file attach flow to the ⌘I widget
   (`DevFeedback.tsx`): file picker, drag-and-drop onto the panel, and paste
   (⌘V) of a clipboard image — each attached file gets a one-click remove
   before submit. Up to 5 files, images or PDF, 8MB each
   (`lib/dev-notes.ts` constants).
3. **Storage**: new `dev_note_attachments` table (one row per file, base64
   `dataUrl` inline — same pragmatic no-object-storage call as before, just
   normalized to multiple rows instead of one column). FK `ON DELETE CASCADE`
   from `dev_notes`.
4. **Cleanup**: attachment rows are deleted once a note is marked "Traité"
   (`setNoteStatus` in `app/dev/actions.ts`, and the skill-facing PATCH route)
   so the table doesn't grow unbounded with resolved notes' payloads.
5. **Display**: `/dev/notes` renders each attachment — images as a thumbnail
   (opens full-size in a new tab), other types as a filename chip (📄, same
   behavior).

## Local dev DB note
While applying the migration, found the local dev DB was missing a tracking
row for the original screenshot migration (`0018`) — it had been applied via
`drizzle-kit push` at some point rather than `migrate`, silently leaving
`npm run db:migrate` permanently stuck retrying it. Also found a stray
Homebrew `postgresql@14` service squatting on port 5432 alongside Docker's,
which is why `db:migrate`/`psql localhost` were silently hitting the wrong
server. Stopped the Homebrew service and backfilled the missing migration
tracking row for local dev — no schema changes beyond what this plan
required. Worth checking staging doesn't have the same untracked-migration
drift before the next staging migration run.

## Out of scope
- Annotating/drawing on an attached image.
- Real object storage (S3/R2) — still not worth it at this tool's scale.
