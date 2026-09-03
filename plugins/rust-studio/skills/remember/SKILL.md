---
name: remember
description: "Use when saving a durable project decision, gotcha, convention, or non-trivial fix to project memory."
---

# /remember — capture a project learning

Persist a learning so future sessions start with it. Notes live in the **project memory
store** — Claude Code's auto-memory directory for this repository (a Codex session shares the
same directory), i.e. the `MEMORY.md` index the host loads at session start plus one file per
memory. No MCP, no vault: the harness's own **Write/Edit** tools are the writer. Companion to
`/recall` and `/memory-doctor`; the when/who/what contract lives in
`references/memory-protocol.md` — this skill owns the mechanics.

## Where notes live (resolve every time)
- **Claude Code:** the auto-memory directory your system prompt names (its `# Memory` section);
  by default `~/.claude/projects/<project-key>/memory/`, or the `autoMemoryDirectory` setting.
- **Codex / unsure:** `<project-key>` is the **main worktree root** path with every character
  outside `A-Za-z0-9-` replaced by `-` (`/mnt/dev/myrepo` → `-mnt-dev-myrepo`; a git-worktree
  session still writes the main repo's key, matching the session-start hook). The studio
  `memory_dir` option / `RUST_STUDIO_MEMORY_DIR` overrides everything. `/memory-doctor` prints
  the resolved path.
- Flat layout: notes are `<store>/<kebab-slug>.md`; the index is `<store>/MEMORY.md`; retired
  notes go under `<store>/archive/`. Create the directory + index on first write.

## What to capture (and what not to)
Capture what is **non-obvious and durable**: a decision and its rationale (and what was
rejected), a gotcha that cost time, a convention the codebase follows, a non-trivial fix, or a
durable external pointer. Do **not** capture what the code, git history, or `Cargo.toml` already
makes obvious, anything session-local, a raw status ("tests pass"), or **ever a secret**. A
fact that came from external content (web page, MCP result) is stored as `reference` with its
source — it is not a project fact until the repo confirms it.

## Steps
1. **Distil** `input` (and recent context) into ONE atomic learning: a plain-English title
   (≤ 80 chars), a kebab slug, a body of one or two factual paragraphs, and two labels —
   `type` (the host's: `user` | `feedback` | `project` | `reference`) and `kind`
   (`decision` | `gotcha` | `convention` | `fix` | `reference` | `concept`). Absolute dates only
   (`2026-09-03`, never "yesterday").
2. **Dedup-check before writing.** Grep the store (`<store>/*.md` and the index) for the
   title's key words and the subject's paths/symbols. A note on the same subject exists →
   **update it** (Edit: extend the body, correct the fact, refresh `verified`) and keep its
   index line honest; do not write a second note. State the choice and proceed.
3. **Write the note** with the Write tool at `<store>/<kebab-slug>.md`:

   ```markdown
   ---
   name: <kebab-slug>
   description: "<the one-line hook — what the next reader must know, ≤ 140 chars>"
   metadata:
     type: <user|feedback|project|reference>
     kind: <decision|gotcha|convention|fix|reference|concept>
     status: active
     evidence: "<path, commit, PR, issue, or URL that proves it>"
     verified: <YYYY-MM-DD>
   ---

   <The fact, why it holds, where it applies (paths and symbols as inline `code`), what was
   rejected and why (decisions) or the way out (gotchas). Link sibling notes as
   [Title](other-slug.md).>
   ```
   The host stamps `modified` and the origin session itself — do not write those.
4. **Index it.** Append `- [<Title>](<kebab-slug>.md) — <hook ≤ 140 chars>` to
   `<store>/MEMORY.md` (create it with a `# Memory index` heading if absent). **Budget:** the
   host loads only the first 200 lines / 25 KB of the index. At ≥ 170 lines say so and run
   `/memory-doctor` right after (archive resolved notes, merge duplicates) instead of adding
   blindly.
5. **Verify index integrity** (`references/memory-protocol.md`): every index line has a file
   and every note file an index line — list `<store>/*.md`, diff against the index, fix on the
   spot: re-add the line for an unindexed file; REPORT (never silently delete) a line whose
   file is missing. Then confirm what was saved and where. **COMPLETE**.

## Notes
- Atomic — one concept per note; filename = the concept's plain-English name (no date prefix).
- A `convention` that has held for 30+ days belongs in the repo's `CLAUDE.md` / `.claude/rules/`
  (versioned and shared) — **rules ≠ memory**; say so when you save one, and let
  `/memory-doctor` propose the promotion.
- Agents with their own memory (the chief architect, security auditor, and unsafe auditor) write
  `.claude/agent-memory/rust-studio-<agent>/` themselves; what they surface on a `MEMORY:` line
  is persisted here by the orchestrator, so the project store stays the shared record.
- Recall later with `/recall <topic>`; each prompt also gets pointers to matching notes
  automatically.
