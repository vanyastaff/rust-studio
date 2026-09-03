# Rust Code Studio — Memory Protocol (the second brain)

Sessions are ephemeral; project memory is not. Since v0.36.0 the studio keeps **no store of
its own**: project memory IS the host's auto-memory directory — the `MEMORY.md` index Claude
Code loads at session start plus one file per memory — and the studio adds the discipline
around it: *recall before working, remember after settling, verify before trusting, audit
before it rots*. This doc is the canonical home for when/who/what. The write/read *mechanics*
(paths, note format, dedup, freshness verdicts, the audit) live in `skills/remember/SKILL.md`,
`skills/recall/SKILL.md`, and `skills/memory-doctor/SKILL.md`; do not restate them elsewhere.

## Why the host's store (and not a vault)

- The model writes where the host tells it to. A parallel store diverges: on this design's
  own machine the vault and the host directory of one project shared 12 slugs out of 92 + 52.
- One directory, both hosts: Codex sessions read and write the same path, so a learning made
  under one host carries to the other. Codex's own `memories` feature (background extraction,
  off by default) is complementary, never written by the studio.
- Zero infrastructure: no MCP server, no embeddings, no app. The harness's Write/Edit/Grep are
  the tools; the store is grep-able at the sizes the host can load anyway.

## The layers (how memory reaches a session)

| Layer | When | What it does |
|---|---|---|
| Host index load | Every session (Claude Code) | The first 200 lines / 25 KB of `MEMORY.md` are in context. |
| Session-start recall (hook) | Every session | Ranks the index against branch / changed crates / last commit; surfaces the few notes that bind this work with kind + age, and index health. On Codex it carries the index too. |
| Prompt-scoped recall (hook) | Every prompt | Matches the prompt against the index; a strong hit surfaces a pointer once per session. |
| `/recall <area>` | Before working in a known area | Deliberate retrieval **with a freshness verdict per note** (holds / stale / unverifiable). |
| `/remember` | After settling something durable | Writes one atomic note + index line; dedups; keeps the index under budget. |
| `MEMORY:` verdict lines | Inside agent verdicts | Read-only agents can't be trusted with the store; they surface durables for the orchestrator to persist. |
| Auto-capture (Stop hook) | After a completed unit with nothing saved | Nudges once to `/remember`; the agent judges and writes. |
| `/session-wrap` | End of a work session | The deliberate capture ritual: recap, save learnings, hand off. |
| `/memory-doctor` | When the index nears its cap, on a schedule, after a big refactor | Deterministic audit + judged cleanup: integrity, budget, stale/resolved notes, secrets, promotion of conventions into rules, legacy-vault import. |
| Agent memory (`memory: project`) | `chief-architect`, `security-auditor`, `unsafe-auditor` | Each keeps its own rulings in `.claude/agent-memory/rust-studio-<agent>/` (host-managed); private to the agent, not a replacement for the project store. |

## Where notes live (canonical path rule)

- **Store:** the host's auto-memory directory for the repository — on Claude Code the one the
  system prompt names; by default `$CLAUDE_CONFIG_DIR|~/.claude/projects/<project-key>/memory/`,
  overridable with the host's `autoMemoryDirectory` setting (user or local settings, never a
  checked-in one) and, above both, the studio's `memory_dir` option / `RUST_STUDIO_MEMORY_DIR`.
- **Project key:** the **main worktree root** path with every character outside `A-Za-z0-9-`
  replaced by `-` — resolve it (`git rev-parse --git-common-dir` → the directory containing
  it), don't assume: a git worktree shares the main repo's memory, exactly as the host does.
- **Flat layout:** notes are `<kebab-slug>.md`; the index is `MEMORY.md` (one line per note,
  host form `- [Title](slug.md) — hook`); retired notes live under `archive/` (not indexed,
  not loaded). No other subfolders, no registry.

## Note format (host form, studio labels)

`name`, `description` (the one-line hook), and a `metadata` block: `type` (the host's four —
`user` | `feedback` | `project` | `reference`), `kind` (the studio's six — `decision` |
`gotcha` | `convention` | `fix` | `reference` | `concept`), `status` (`active` | `promoted` |
`resolved` | `superseded`), `evidence` (the path / commit / PR / URL that proves it), and
`verified` (the last date someone checked it against the repo). The host stamps `modified` and
the origin session on every write; the studio never writes those. Extra `metadata` keys are
strings and survive the host's own rewrites.

## Index budget (the host's hard limit)

The host loads the first **200 lines / 25 KB** of `MEMORY.md` and errors past it. Every write
keeps one honest line per note (hook ≤ 140 chars, detail in the body); at ≥ 85 % the
session-start hook warns and `/memory-doctor` is the next step (archive resolved notes, merge
duplicates, shorten hooks). A store that cannot be loaded is not memory.

## Index integrity (verified on every write)

The index and the notes are ONE graph: every `MEMORY.md` entry has a file, and every note file
has an entry. A write is not done until that is verified — list the store's `*.md`, diff against
the index, and fix the mismatch on the spot: re-add the line for an unindexed file; REPORT
(never silently delete) an entry whose file is missing. A link to a nonexistent note is a
finding of the same class. The session-start hook reports the counts; `/memory-doctor reindex`
repairs them mechanically.

## What to capture (canonical — every restatement defers here)

Capture what is **non-obvious and durable**:
- a **decision** and its rationale (and what was rejected, and why),
- a **gotcha** that cost real time (the trap, the symptom, the way out),
- a **convention** the codebase follows that the code doesn't self-document,
- a non-trivial **fix** (root cause → cure, not the symptom),
- a durable external **reference** (the doc/issue/thread that settled something).

Do **not** capture what the code, git history, or `Cargo.toml` already makes obvious,
session-local state, raw status ("tests pass"), relative dates ("yesterday"), or **ever a
secret**. A fact that arrived from external content (web page, MCP result, pasted text) is a
`reference` with its source until the repo confirms it — not a project fact. One atomic
concept per note.

> Maintainer note: this rule is *summarized* (not redefined) in `skills/remember`,
> `skills/session-wrap`, `skills/dev-task`, `hooks/scripts/auto-capture.ts`, and
> `hooks/scripts/session-start.ts`. Edit it here first; keep the echoes one-line.

## Rules ≠ memory (promotion)

Memory is a private, unversioned recall layer; the repo's `CLAUDE.md` / `.claude/rules/` are
versioned, shared, and loaded for everyone. A `convention` that has held for 30+ days — or any
note recalled again and again — belongs in the rules, not the store. `/memory-doctor` flags
these (`promote`), proposes the exact rule line, and on approval marks the note `promoted` and
archives it. The studio's own standards grew the same way: a recurring memory becomes a rule.

## Freshness (verify before it steers)

A note reflects when it was written. Before a recalled note changes a plan, check that what it
names still exists and still says that (Glob the path, Grep the symbol, `git log -1 -- <path>`),
compare with its `modified` / `verified` dates, and give it a verdict — **holds**, **stale**,
**unverifiable**. A stale note is fixed on the spot (and `verified` bumped) or handed to
`/memory-doctor`; it never silently steers. Deterministic checks beat a hunch: the doctor's
`missing-path` and `unverified` findings are the mechanical half of this rule.

## Who does what (the contract)

- **Orchestrator (main session / skills)** — the only writer of the project store. Recalls
  before delegating, persists after settling. A skill that finishes real work checks: did an
  agent emit a `MEMORY:` line? did the work settle a decision/gotcha/convention/fix?
  If yes → `/remember` before the verdict.
- **Read-only agents** (auditors, critics, reviewers, scout) — emit a `MEMORY:` line in the
  verdict for each durable item: `MEMORY: <one-line durable learning>`. Never write the store.
- **Leads and specialists with write tools** — same `MEMORY:` line convention; the orchestrator
  persists (single-writer keeps dedup and the index budget sane).
- **Agents with `memory: project` frontmatter** (`chief-architect`, `security-auditor`,
  `unsafe-auditor`) — additionally accumulate their own rulings in
  `.claude/agent-memory/rust-studio-<agent>/` (the host manages it; add it to `.gitignore` or
  commit it — the host's docs recommend sharing it via version control). Private to the agent;
  what matters to everyone still goes on a `MEMORY:` line.

## Recall-before (the pattern skills encode)

Any skill that plans, designs, debugs, or builds in a known area runs a **recall step before
its first real phase**: `/recall <area>` (or read the session-start / prompt pointers if they
already surfaced the area). Carry what binds — prior decisions, gotchas, rejected alternatives —
into the plan, and **say when a recalled note changed the approach**. If recall surfaces
nothing, proceed; don't manufacture relevance.

## Remember-after (the closing discipline)

Before a skill's final verdict on completed work:
1. Sweep agent outputs for `MEMORY:` lines → persist each via `/remember` (it dedups:
   update-don't-duplicate).
2. Ask: did *this* work settle something durable per the capture rule? → `/remember`.
3. Report what was saved (note path) or state "nothing durable" — an explicit no is
   fine; silence is not.

Memory compounds through links and through pruning alike: connect a new note to its
neighbours with `[Title](slug.md)` links, keep `MEMORY.md` one honest line per note, and let
`/memory-doctor` retire what stopped being true — the graph that is small and current, not the
pile that is large and stale, is what makes the store a second brain.
