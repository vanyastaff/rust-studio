---
name: dev-task
description: "implement feature story task build — run one unit of Rust work end-to-end: scout → plan → approve → build → review. Use for any scoped change that needs discipline: new feature, story, or multi-file edit."
argument-hint: "[task/story description, or path to a story file]"
user-invocable: true
---

# /dev-task — implement one unit of work

Run a single task through **scout → plan → approve → build → review**, honoring the
collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`, §8 team
execution). You are the orchestrator: **you do not write code or tests yourself — you
delegate writes to `rust-builder`.** Gate with `AskUserQuestion` only at phase boundaries
(plan approval, BLOCKED recovery) — decide tactical calls yourself, state choice + one-line
rationale.

## Orchestration
When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), run this as a real
team: `TeamCreate`, then spawn `rust-scout`, the owning lead, `rust-builder`, and
`rust-reviewer` as teammates and coordinate via the shared task list (`TaskCreate` one task
per phase, order with `addBlockedBy`: scout → plan → build → review, assign with
`TaskUpdate owner`) + `SendMessage`. Otherwise fall back to single-orchestrator delegation:
spawn sub-agents sequentially and inline each phase's context into the spawn prompt. Teammates
don't inherit this plan (pass it in the spawn prompt) and don't get bundled MCP (they rely on
the user's ambient serena/exa); status can lag, so have teammates mark tasks `completed`.
Drive `TeamDelete` cleanup at the end (shut teammates down with `SendMessage
{type:"shutdown_request"}` first).

## Input
`$ARGUMENTS` is the task. If it's a path, read that file. If empty, ask: "What should we
build?" and, for non-trivial work, suggest running `/architecture` or `/brainstorm` first.

## Pick the review mode
Default **lean** (one crate, routine). Use **full** for public APIs, `unsafe`, releases, or
cross-crate changes. Use **solo** for prototypes. State which mode you're using and why.

## Phase 1 — Scope & locate
1. Restate the task and its acceptance criteria in 1–3 bullets. Confirm with the user if fuzzy.
2. Task owned by **`rust-scout`** to map the edit sites and existing tests. Don't guess the
   layout. Scout uses serena MCP for symbol/reference navigation and `rg` for macro-generated
   or `cfg`-gated sites serena can't see — never Bash `grep`/`find`. (As a teammate, scout
   relies on the user's ambient serena — it is not bundled into the spawn.)
3. Identify the owning lead from the domain (see `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md`).

## Phase 2 — Plan (blocked by scout)
4. Task owned by the **owning lead** (e.g. `api-design-lead`, `async-systems-lead`) — or
   `chief-architect` if the design is non-trivial — to produce a short plan: files to
   change, the approach, test strategy, risks, and which gate(s) apply.
5. If the plan reveals a real design decision, present 2–4 options with trade-offs.

## Phase 3 — Approve (gate)
6. `AskUserQuestion`: show the plan and the chosen approach; get explicit approval before
   any code is written. If the user wants changes, loop back to Phase 2.

## Phase 4 — Build (blocked by approval)
7. Task owned by **`rust-builder`** with the approved plan (pass it in the spawn prompt —
   teammates don't inherit it). Instruct it to:
   - work test-driven where practical (failing test → implement → refactor),
   - stay strictly in scope (no opportunistic refactors),
   - run `cargo test`/`nextest`, `cargo clippy --all-targets --all-features -- -D warnings`,
     and `cargo fmt`, and fix issues,
   - add `// SAFETY:` notes to any `unsafe` and flag it.
8. The builder reports a diff summary + command output. Show it to the user.

## Phase 5 — Review (gate; blocked by build)
9. Task owned by **`rust-reviewer`** on the diff. For **full** mode, also run the owning
   lead's gate checklist as sibling tasks (and `unsafe-auditor` if `unsafe` was touched,
   `security-auditor` for input/auth/deserialization) — these read-only lenses can run
   concurrently as teammates.
10. If findings are NEEDS WORK, hand them back to `rust-builder` (loop Phase 4) until clean
    or the user decides to stop.

## Phase 6 — Verdict
11. Summarize: what changed, evidence (tests/clippy output), gates passed, and anything
    left out of scope. Every teammate's contribution ends in **COMPLETE / NEEDS WORK /
    BLOCKED** with evidence. End with **COMPLETE / NEEDS WORK / BLOCKED**.
12. Suggest next steps: `/review` for a deeper audit, `/perf` if perf-sensitive,
    `/changelog` if user-facing, `/publish` if it's release-bound. If running as a team,
    drive cleanup: `SendMessage {type:"shutdown_request"}` to each teammate, then `TeamDelete`.

## Error recovery
If any sub-agent returns **BLOCKED** (missing ADR, undecided design, absent dependency):
surface it immediately, do not proceed past the blocked dependency, and `AskUserQuestion`
with options — (a) skip and note the gap, (b) retry with narrower scope, (c) stop and run
the prerequisite skill (e.g. `/adr`, `/architecture`). Never discard completed work.
