---
name: memory-doctor
description: "Use when project memory needs an audit: index budget, integrity, stale notes, secrets, or promotion to rules."
---

# /memory-doctor — keep project memory true and small

Memory rots silently: paths move, fixes land, the index outgrows what the host loads (the first
200 lines / 25 KB of `MEMORY.md`), and a note written from one session's viewpoint reads as
fact forever. This skill runs a **deterministic audit** and then you judge each finding against
the repo. Nothing is deleted: notes are archived under `archive/`, merges are edits, and every
mutation is a dry run until `--apply`. Contract: `references/memory-protocol.md`.

## Steps
1. **Audit** (from the skill directory; `--json` for the raw report):
   ```bash
   bun "scripts/memory-doctor.ts" audit --cwd "$PWD"
   ```
   It prints the store path and how it was resolved, the index budget, integrity (dangling
   lines, unindexed files, duplicates), and per-note findings: `missing-path`, `unverified`
   (≥ 90 days since modified/verified), `resolved`, `relative-date`, `secret`, `untyped`,
   `long-hook`, `promote`.
2. **Fix integrity first** (mechanical): `reindex --apply` appends a line for every unindexed
   note; for a dangling line decide — the note was archived or removed → drop the line (Edit);
   the subject still matters → recreate the note.
3. **Judge each flagged note** — open it, verify against the repo (Glob / Grep / `git log`):
   - `missing-path` → update the path, or archive if the subject is gone.
   - `unverified` → still true → set `verified: <today>`; false → fix or archive.
   - `resolved` → archive (`archive <file> --apply`) unless the *reason it happened* is the
     durable part — then rewrite it as a `gotcha` and re-verify.
   - `relative-date` → rewrite with absolute dates.
   - `secret` → remove it now (Edit), tell the user it was stored so it can be rotated.
   - `untyped` → add `metadata.type` (`user|feedback|project|reference`) and `kind`.
   - `long-hook` → shorten the index line to ≤ 140 chars; the detail goes into the body.
   - `promote` → a convention that held ≥ 30 days, or one flagged a second time, belongs in
     the repo's `CLAUDE.md` or `.claude/rules/` (versioned, shared — rules ≠ memory): propose
     the exact line; on approval add it, set the note `status: promoted`, then archive it.
     Take the highest rung the convention supports — a lint, `deny.toml` entry, or CI check
     beats prose that a reader has to remember. If the repo has no `CLAUDE.md` to promote
     into, that is the finding: offer to create one from
     `references/templates/project-claude-md.md` rather than leaving the note to age.
   - Near-duplicates (same subject, two notes): keep one, fold the other's facts in, archive
     the rest.
4. **Budget:** above 85% of the cap, archive resolved/superseded notes, merge duplicates, and
   shorten hooks until the index has headroom; report before/after.
5. **Import a legacy Obsidian vault** (one-time, only when asked or when `~/memory/projects/
   <project>/` exists and the store does not):
   ```bash
   bun "scripts/memory-doctor.ts" import "<vault>/projects/<project>" --cwd "$PWD"          # dry run
   bun "scripts/memory-doctor.ts" import "<vault>/projects/<project>" --cwd "$PWD" --apply
   ```
   Frontmatter and wikilinks are converted to the host form; existing files are never
   overwritten; check the projected line count against the cap first. Then run `audit` again —
   imported notes carry their original dates, so old ones show up as `unverified`.
6. **Report:** budget and counts before/after, what was archived / promoted / verified /
   merged, and what stays open. Paste the closing `audit` summary. **COMPLETE**.

## Rules
- Archive and promote in approved batches (Question → Options → Decision) — never `rm`.
- The index stays one honest line per note; the body holds the detail.
- The judgement is yours; the script only makes the evidence deterministic and repeatable.
