---
name: recall
description: "Use when starting related work: recall project decisions, gotchas, conventions, and fixes; verify each holds."
---

# /recall — retrieve project memory, verified

Pull the few notes that bind the task into context — and check they are still true — so work
compounds instead of repeating (protocol: `references/memory-protocol.md`). Companion to
`/remember` and `/memory-doctor`.

## Where notes live
The same store `/remember` writes: on Claude Code the auto-memory directory named in your
system prompt (`# Memory`), else `~/.claude/projects/<project-key>/memory/` with
`<project-key>` = main-worktree root path, non-`A-Za-z0-9-` → `-` (studio `memory_dir` /
`RUST_STUDIO_MEMORY_DIR` overrides). The index is `<store>/MEMORY.md`. The host loads that index
at session start, the session-start hook ranks it against the branch, and every prompt gets
pointers to notes that match it — `/recall` is the deliberate, deeper pass.

## Steps
1. If `input` is empty, read the index and summarize what is there by `kind`, most relevant
   first (use the branch name and changed files as the signal).
2. Otherwise **rank-search the store**: Grep the index (title + hook) and then the note bodies
   (`<store>/*.md`; also `.claude/agent-memory/*/` for the agents' own rulings) for the topic's
   words, paths, and symbols. A hit in a slug or title outranks one in a body; a note several
   terms agree on ranks highest. Read the top few notes (not the whole neighbourhood).
3. **Verify before it steers.** A note reflects when it was written. For each recalled note,
   check what it names still exists and still says that — Glob the paths, Grep the symbol or
   flag, `git log -1 -- <path>` for when the code last moved — and compare with the note's
   `modified` / `verified` dates. Give each a verdict: **holds**, **stale** (what changed), or
   **unverifiable**. A stale note is fixed now (Edit the fact, set `verified: <today>`) or
   handed to `/memory-doctor`; it never silently steers the plan.
4. Present each as: **title** (`kind`, age) → the key takeaway → verdict → note path. Say when
   a recalled note changes the approach.
5. If nothing matches, say so plainly and suggest capturing with `/remember` once the work is
   done.

## Output
A short, ranked list of relevant notes with their takeaways and freshness verdicts, each with
its path. Lead with the single most relevant learning. Don't pad with marginally-related notes.
