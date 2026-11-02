# Rust Code Studio — Memory Protocol (the second brain)

Project memory uses the host-designated store, with an index and one file per note. The
studio maintains no parallel store. Recall relevant decisions, capture only when authorized,
and verify facts before they steer work. This document owns when/who/what. The write/read mechanics
(paths, note format, dedup, freshness verdicts, the audit) live in `skills/write-docs/SKILL.md`,
`skills/inspect-project/SKILL.md`, and `skills/review-work/SKILL.md`; do not restate them elsewhere.

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
| `/inspect-project --mode recall <area>` | Before working in a known area | Deliberate retrieval **with a freshness verdict per note** (holds / stale / unverifiable). |
| `/write-docs --mode memory` | Authorized durable capture | Writes one atomic note and index line, deduplicated and within budget. |
| `MEMORY:` verdict lines | Inside agent results | Evidence-backed candidates; the coordinator writes only when authorized. |
| Auto-capture reminder | After a completed unit | Suggests candidates only; host/user authorization still governs writing. |
| `/write-docs --mode handoff` | End of a work session | Preserve task evidence and next actions; memory capture needs its own authorization. |
| `/review-work --mode memory` | Requested memory assessment | Read-only audit of integrity, budget, stale notes, secrets and promotion candidates. Cleanup/import is a separately authorized write-docs memory operation. |
| Optional host agent memory | Only when configured and authorized | Inspect actual host behavior; a profile is not a memory-store permission. |

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
session-start hook warns. Read-only memory review identifies archive, deduplication and
shortening candidates; apply them only under authorized memory-writing scope.

## Index integrity (verified on every write)

The index and the notes are ONE graph: every `MEMORY.md` entry has a file, and every note file
has an entry. A write is not done until that is verified — list the store's `*.md`, diff against
the index, and fix the mismatch on the spot: re-add the line for an unindexed file; REPORT
(never silently delete) an entry whose file is missing. A link to a nonexistent note is a
finding of the same class. The session-start hook reports counts; memory review diagnoses
index gaps. Requested reindexing runs under write-docs memory authorization.

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

> Maintainer note: this rule is summarized in write-docs memory/handoff modes,
> implement-change, `hooks/scripts/auto-capture.ts`, and
> `hooks/scripts/session-start.ts`. Edit it here first; keep the echoes one-line.

## Rules ≠ memory (promotion)

Memory is a private, unversioned recall layer; the repo's `CLAUDE.md` / `.claude/rules/` are
versioned, shared, and loaded for everyone. A convention that has held for 30+ days or is repeatedly
recalled is a candidate for a shared rule. `/review-work --mode memory` flags
these candidates and proposes the exact rule line. Authorized artifact/memory writing can
apply the rule and mark/archive the note. Review itself remains read-only.

### Flagged twice is a rule, not a note

Time is one promotion trigger; **repetition is the other, and it is faster**. The first time a
review, a gate, or a PR thread flags something, you fix it — that is a correction. The *second*
time the same class of finding appears, the correction has failed to stick, and re-explaining it
per change is now the expensive option. Propose the supported rung below and apply it only
within the authorized write scope:

| Rung | Form | Use when |
|---|---|---|
| 1. **Correction** | fix the diff, say why | first occurrence |
| 2. **Note** | a `convention` note in the store | recurred, and it is *this* project's taste |
| 3. **Rule** | a line in `CLAUDE.md` / `.claude/rules/` | recurred, and it binds everyone on the repo |
| 4. **Gate** | a clippy lint, `[lints]` entry, `deny.toml` rule, CI check, or hook | it can be decided mechanically |

**Recommend the highest rung the finding supports.** A convention a linter can enforce should
not be a paragraph a reader has to remember: `clippy::disallowed_methods`, a `deny.toml` ban, or
a workspace `[lints]` entry holds without attention and cannot be forgotten under deadline. Prose
is for judgment calls that no lint can express — and prose should say *why*, not just what, so
the next reader can reason past it rather than pattern-match it.

Who applies it: `/review-work --mode diff` and `/implement-change --mode pr-feedback` name the rung when a finding repeats,
`/write-docs --mode handoff` sweeps the session for repeats before it closes, and `/review-work --mode memory`'s
`promote` finding is the deterministic backstop for anything that slipped through. A finding
that escaped review and appeared later in CI or production is a candidate for an authorized
regression fixture, preserving evidence of the original miss.

## Freshness (verify before it steers)

A note reflects when it was written. Before a recalled note changes a plan, check that what it
names still exists and still says that (Glob the path, Grep the symbol, `git log -1 -- <path>`),
compare with its `modified` / `verified` dates, and give it a verdict — **holds**, **stale**,
**unverifiable**. Report stale evidence and exclude it from the decision; fix the note and
verification date only when memory-writing authorization permits. Deterministic checks beat a hunch: the audit's
`missing-path` and `unverified` findings are the mechanical half of this rule.

## Who does what

The coordinator is the single writer of an authorized project-memory update. Roles may return
MEMORY candidates with evidence; those suggestions do not authorize persistence. Read-only
roles never write the store. Managed role/profile names do not imply memory: project settings;
inspect actual host configuration and honor the user's policy.

An explicit memory request uses `/write-docs --mode memory`. A session handoff preserves task
progress and evidence in the authorized design artifacts. It writes memory only when the host
or user separately permits that store and action. Memory audit defaults to read-only; requested
cleanup is a distinct authorized artifact operation.

## Recall-before (the pattern skills encode)

Any skill that plans, designs, debugs, or builds in a known area runs a **recall step before
its first real phase**: `/inspect-project --mode recall <area>` (or read the session-start / prompt pointers if they
already surfaced the area). Carry what binds — prior decisions, gotchas, rejected alternatives —
into the plan, and **say when a recalled note changed the approach**. If recall surfaces
nothing, proceed; don't manufacture relevance.

## Authorized capture

At completion retain durable decisions and current task evidence in the requested artifacts.
If a memory update is authorized, deduplicate candidates, write the note/index and verify
integrity. Report the saved path when relevant. A skipped unauthorized memory write does not
block a completed task, and a reminder hook never grants authority. Keep the actual task
outcome and evidence in the final response rather than replacing it with bookkeeping.

Memory compounds through links and through pruning alike: connect a new note to its
neighbours with `[Title](slug.md)` links, keep `MEMORY.md` one honest line per note, and let
memory review identify what stopped being true. Authorized updates keep the graph current;
auditing the store does not authorize pruning it.
