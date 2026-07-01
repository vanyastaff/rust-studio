# Rust Code Studio — Memory Protocol (the second brain)

One Obsidian vault is the studio's durable design record. Sessions are ephemeral; the
vault is not. The protocol has two verbs — **recall before working, remember after
settling** — and this doc is the canonical home for when/who/what. The write/read
*mechanics* (MCP tools, note format, dedup flow) live in `skills/remember/SKILL.md`
and `skills/recall/SKILL.md`; do not restate them elsewhere.

## The layers (how memory reaches a session)

| Layer | When | What it does |
|---|---|---|
| Session-start recall (hook) | Every session | Injects a ranked index of the project's notes (title + hook + path), ranked against branch/changed crates/last commit. |
| `/recall <area>` | Before working in a known area | Targeted semantic search; pulls the few notes that bind the task at hand. |
| `/remember` | After settling something durable | Writes one atomic note + index line to the vault. |
| `MEMORY:` verdict lines | Inside agent verdicts | Read-only agents can't write the vault; they surface durables for the orchestrator to persist. |
| Auto-capture (Stop hook) | After a completed unit with nothing saved | Nudges once to `/remember`; the agent judges and writes. |
| `/session-wrap` | End of a work session | The deliberate capture ritual: recap, save learnings, hand off. |

## Where notes live (canonical path rule)

- **Vault root:** `$OBSIDIAN_VAULT_PATH`, default `~/memory`. The `vault_path` plugin
  setting overrides the env var. Never hardcode a path.
- **Project folder:** `<vault>/projects/<project>/`, where `<project>` is the basename
  of the **main worktree root** — resolve it, don't assume:
  `git rev-parse --git-common-dir` → the directory containing that `.git` dir. For a
  plain checkout this is just the repo root; for a **git worktree** it is the main
  repo, so a session in `…/myrepo-feature-x/` still reads and writes
  `projects/myrepo/`. (The session-start hook already resolves this way; skills must
  match or recall and remember silently diverge.)
- Flat layout: notes are `<kebab-slug>.md`; the index is `MEMORY.md` (one line per
  note). No subfolders, no registry.

## What to capture (canonical — every restatement defers here)

Capture what is **non-obvious and durable**:
- a **decision** and its rationale (and what was rejected, and why),
- a **gotcha** that cost real time (the trap, the symptom, the way out),
- a **convention** the codebase follows that the code doesn't self-document,
- a non-trivial **fix** (root cause → cure, not the symptom),
- a durable external **reference** (the doc/issue/thread that settled something).

Do **not** capture what the code, git history, or `Cargo.toml` already makes obvious,
session-local state, or raw status ("tests pass"). One atomic concept per note.

> Maintainer note: this rule is *summarized* (not redefined) in `skills/remember`,
> `skills/session-wrap`, `skills/dev-task`, `hooks/scripts/auto-capture.ts`, and
> `hooks/scripts/session-start.ts`. Edit it here first; keep the echoes one-line.

## Who does what (the contract)

- **Orchestrator (main session / skills)** — the only writer. Recalls before
  delegating, persists after settling. A skill that finishes real work checks: did an
  agent emit a `MEMORY:` line? did the work settle a decision/gotcha/convention/fix?
  If yes → `/remember` before the verdict.
- **Read-only agents** (auditors, critics, reviewers, scout) — emit a `MEMORY:` line
  in the verdict for each durable item: `MEMORY: <one-line durable learning>`. Never
  write the vault themselves.
- **Leads and specialists with write tools** — same `MEMORY:` line convention; the
  orchestrator persists. (Sub-agents shouldn't take a vault-write dependency: MCP
  availability inside sub-agents varies, and single-writer keeps dedup sane.)
- **Agents with `memory: project` frontmatter** (`chief-architect`,
  `security-auditor`, `unsafe-auditor`) — additionally accumulate their own working
  memory across sessions; that is private to the agent and does not replace the vault.

## Recall-before (the pattern skills encode)

Any skill that plans, designs, debugs, or builds in a known area runs a **recall
step before its first real phase**: `/recall <area>` (or read the session-start
index if it already surfaced the area). Carry what binds — prior decisions, gotchas,
rejected alternatives — into the plan, and **say when a recalled note changed the
approach**. If recall surfaces nothing, proceed; don't manufacture relevance.
Recalled notes reflect when they were written — verify a note still holds (the file/
flag/API it names still exists) before letting it steer.

## Remember-after (the closing discipline)

Before a skill's final verdict on completed work:
1. Sweep agent outputs for `MEMORY:` lines → persist each via `/remember` (it dedups:
   update-don't-duplicate).
2. Ask: did *this* work settle something durable per the capture rule? → `/remember`.
3. Report what was saved (note path) or state "nothing durable" — an explicit no is
   fine; silence is not.

Memory compounds through links: when saving, connect the note to its neighbours with
`[[wikilinks]]` and keep `MEMORY.md` one honest line per note — the graph, not a pile
of orphaned files, is what makes the vault a second brain.
