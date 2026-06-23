---
name: dev-task
description: "implement feature story task build — run one unit of Rust work end-to-end: scout → plan → approve → build → review. Use for any scoped change that needs discipline: new feature, story, or multi-file edit."
argument-hint: "[task/story description, or path to a story file]"
user-invocable: true
---

# /dev-task — implement one unit of work

Run a single task through **scout → plan → approve → build → review** — or a **fast path** for
genuinely trivial changes (Phase 0) — honoring the
collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`, §8 team
execution). You are the orchestrator: **you do not write code or tests yourself — you
delegate writes to `rust-builder`.** **The plan-approval gate runs through native plan mode**
(`EnterPlanMode` → write the plan file → `ExitPlanMode`), so the plan renders in the Desktop
**Plan** pane and is approved natively (on CLI it's the standard plan-mode approval — no
regression). Use `AskUserQuestion` only for genuine design forks and BLOCKED recovery, **not**
for "approve the plan?" — that's what `ExitPlanMode` is for. Decide tactical calls yourself,
state choice + one-line rationale.

## Orchestration
When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), run this as a real
team: the session already has one implicit shared team, so spawn `rust-scout`, the owning lead,
`rust-builder`, and `rust-reviewer` as teammates directly (no `TeamCreate`) and coordinate via
the shared task list (`TaskCreate` one task
per phase, order with `addBlockedBy`: scout → plan → build → review, assign with
`TaskUpdate owner`) + `SendMessage`. Otherwise fall back to single-orchestrator delegation:
spawn sub-agents sequentially and inline each phase's context into the spawn prompt. Teammates
don't inherit this plan (pass it in the spawn prompt) and don't get bundled MCP (they rely on
the user's ambient serena/exa); status can lag, so have teammates mark tasks `completed`.
Shut teammates down at the end with `SendMessage {type:"shutdown_request"}` — there is no team
to delete; idle teammates auto-hide.

## Progress visibility
The user follows the **task list** to know where things stand — keep it live, do not go silent
until the end. When `progress_tracking` is on (`${user_config.progress_tracking}`, default on), in
**both** team and single-orchestrator mode:
1. At the start, `TaskCreate` one task per phase — scout → plan → build → review — so the whole
   plan is visible up front (team mode also wires `addBlockedBy`; solo mode just creates them).
2. Before spawning a phase, `TaskUpdate` its task to `in_progress`.
3. The moment that phase's sub-agent returns, surface its result in one line (scout's edit-site
   map, the plan's verdict, the build's diff summary, the review's findings) and `TaskUpdate` the
   task to `completed` — **before** starting the next phase. The user sees intermediate results,
   not one final dump.
4. Keep phases the user is waiting on in the **foreground** — a backgrounded phase reads as a hang.
5. (Optional status bar) If the user ran `/progress-bar`, also mirror the phase to the studio
   status line at each boundary:
   `bun "${CLAUDE_PLUGIN_ROOT}/scripts/progress.ts" set --phase "<phase>" --step "<n/total>" [--tasks "<done/total>"]`,
   and `bun "${CLAUDE_PLUGIN_ROOT}/scripts/progress.ts" clear` at the end. Harmless no-op if they
   never enabled the status line.
When off, run the phases without the task-list narration.

## Input
`$ARGUMENTS` is the task. If it's a path, read that file. If empty, ask: "What should we
build?" and, for non-trivial work, suggest running `/architecture` or `/brainstorm` first.

## Pick the review mode
Default **lean** (one crate, routine). Use **full** for public APIs, `unsafe`, releases, or
cross-crate changes. Use **solo** for prototypes. State which mode you're using and why.
Any non-trivial task must also apply the pre-code maintainer standard in
`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md` before code is written.

## Phase 0 — Right-size the ceremony (triage first)
The most common SDD failure mode is *over-process* — turning a one-line fix into a multi-phase
plan and a spec nobody needed. Match the ceremony to the change, **never the quality bar**: a
fast path skips planning *overhead*, not tests, idiom, or review.

**Fast path** — take it only when ALL hold: a single obvious edit site (or a few mechanical
ones), no design fork, no new/changed public API, no `unsafe`, no cross-crate ripple, no new
dependency (a typo/doc fix, a localized bug with a clear cause, a serena-drivable rename). Then:
- Skip Phases 1–3 — no scout sweep, no plan file, no `ExitPlanMode` gate. State one line:
  *"Fast path: <change> — <why it qualifies>."*
- Still **red→green for any behavior change**, still `clippy -D warnings` + `fmt` clean, still a
  quick `rust-reviewer` pass (Phase 5b) and a Phase 6 verdict. Quality is never on the chopping block.
- If triage proves wrong — the "one-liner" reveals a design choice, a cross-crate ripple, or a
  public-API/`unsafe` touch — **stop and enter the full loop.** Abandoning a fast path mid-task
  is correct, not failure; it's the honest move the moment a condition above stops holding.

**Full loop** — everything else (features, public-API / `unsafe` / cross-crate changes, anything
with a real design decision) runs Phases 1–6 below under the chosen review mode. This is *not* a
quick-win escape hatch: when in doubt, take the full loop.

## Phase 1 — Scope & locate
0. **Enter plan mode.** If you are not already in plan mode, call `EnterPlanMode` to obtain the
   plan-file path. Phases 1–2 are read-only anyway (scout + lead plan, no code until approval),
   so this fits with no workflow change — it just routes the upcoming Draft→Approval through the
   native Plan pane. `AskUserQuestion` is still allowed *inside* plan mode for genuine design
   forks (Phase 2 step 7); only the approval gate moves to `ExitPlanMode`.
1. Restate the task as **acceptance criteria in observable form** — given/when/then, or
   input → effect → edge case — 1–3 of them, not a sprawl (over-specification is the Phase-0
   failure; keep criteria to what actually pins the behavior). Confirm with the user if fuzzy.
   Where the change has an **externally observable behavior**, write the **outer acceptance test**
   now (the highest-level test that asserts the feature from outside) and confirm it **fails** (red).
   This is the outer loop of a double loop: the acceptance test pins "done from the outside", and
   Phase 4's unit-level TDD drives inward to make it pass. Pure internal refactors with no external
   behavior change skip the acceptance test — their existing unit tests are the anchor.
2. Task owned by **`rust-scout`** to map the edit sites and existing tests. Don't guess the
   layout. Scout uses serena MCP for symbol/reference navigation and `rg` for macro-generated
   or `cfg`-gated sites serena can't see — never Bash `grep`/`find`. (As a teammate, scout
   relies on the user's ambient serena — it is not bundled into the spawn.)
3. Identify the owning lead from the domain (see `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md`).

## Phase 2 — Plan (blocked by scout)
4. Task owned by the **owning lead** (e.g. `api-design-lead`, `async-systems-lead`) — or
   `chief-architect` if the design is non-trivial — to produce a short plan: files to
   change, the approach, test strategy, risks, and which gate(s) apply.
5. Require a **Maintainer-grade pre-code verdict** from
   `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`: `ACCEPTABLE`,
   `RESHAPE NEEDED`, or `BLOCKED`. The verdict must cover crate ownership, sibling-crate
   reuse, ecosystem/current-doc checks where relevant, API/type-system shape, performance
   posture, active-dev breaking-change policy, and likely strict-maintainer rejection reasons.
6. If the verdict is `RESHAPE NEEDED`, reshape the plan before build. Do not let builder write
   the junior local patch and rely on review to fix it afterward. If the reshape changes
   product scope or creates an irreversible/outward action, surface the fork for approval.
7. If the plan reveals a real design decision, present 2–4 options with trade-offs.
8. **Write the plan into the plan file** (the one from `EnterPlanMode`), building it
   incrementally — this is what renders in the Desktop **Plan** pane. Consolidate the lead's
   plan (files to change, approach, test strategy, risks, applicable gates) **and** the
   `ACCEPTABLE / RESHAPE NEEDED / BLOCKED` maintainer verdict into it. Keep mirroring each
   phase's one-line result to the task list as before (progress visibility is unchanged).

## Phase 3 — Approve (gate)
9. **`ExitPlanMode`** to request approval — it reads the plan from the plan file (do not pass
   the plan as an argument, and do not use `AskUserQuestion` to ask "approve?"). Pass
   `allowedPrompts` for the build commands the plan needs (e.g. `run tests`, `run clippy`,
   `cargo fmt`). If the user rejects or asks for changes, loop back to Phase 2 and **rewrite the
   plan file** — same loop, native surface.

## Phase 4 — Build (blocked by approval)
**Inner loop drives toward the outer acceptance test.** Each unit-level red→green cycle moves the
Phase-1 acceptance test closer to green; build is complete only when that outer test (where one was
written) passes — not merely when the unit tests do.
10. Task owned by **`rust-builder`** with the approved plan and the maintainer-grade verdict
   (pass them in the spawn prompt —
   teammates don't inherit it). Instruct it to:
   - for any **behavior** change, write the test FIRST and show it **failed before the fix**
     (red→green) — this evidence is required, not "where practical"; the test must be able to fail
     (assert the value/effect, not `is_ok()` or a tautology),
   - implement the smallest correct architecture-compatible change, not the smallest textual
     diff,
   - reshape touched code when the approved plan requires it; no compatibility shims or
     half-migrations in active-dev mode,
   - run `cargo test`/`nextest`, `cargo clippy --all-targets --all-features -- -D warnings`,
     and `cargo fmt`, and fix issues,
   - add `// SAFETY:` notes to any `unsafe` and flag it.
11. The builder reports a diff summary + command output. Show it to the user.

## Phase 5 — Review (gate; blocked by build)
Two stages — **spec compliance first, then code quality** (the superpowers subagent-driven-dev
pattern); a finding in EITHER stage loops back to `rust-builder` and re-runs that stage before
advancing.
12. **Stage 5a — spec compliance.** First, the **outer acceptance test passes** (the executable
    anchor from Phase 1, where one exists) — a green acceptance test is the objective proof the spec
    is met, not a re-reading of prose. Then check the diff against the Phase-1 acceptance criteria
    and the approved plan: exactly what was specified — nothing missing, nothing extra (scope
    creep)? Use `rust-reviewer` with a spec-compliance lens (or `product-steward` for scope). On a
    gap, hand back to `rust-builder` and re-run 5a. **Do not start 5b until 5a is ✅.**
13. **Stage 5b — code quality.** Task owned by **`rust-reviewer`** on the diff for correctness,
    soundness, standards, and tests. For **full** mode, also run the owning lead's gate checklist as
    sibling tasks (and `unsafe-auditor` if `unsafe` was touched, `security-auditor` for
    input/auth/deserialization) — these read-only lenses run concurrently as teammates.
14. If either stage returns NEEDS WORK, hand findings back to `rust-builder` (loop Phase 4) and
    re-run the failing stage until clean or the user decides to stop.

## Phase 6 — Verdict
15. Summarize: what changed, evidence (tests/clippy output), gates passed, and anything
    left out of scope. Every teammate's contribution ends in **COMPLETE / NEEDS WORK /
    BLOCKED** with evidence. End with **COMPLETE / NEEDS WORK / BLOCKED**.
    A `COMPLETE` verdict **requires both Phase 5 stages (spec compliance + code quality)** and the
    failing-test-first evidence; if any disciplined step (pre-code verdict, red test, either review
    stage) was skipped, say which and why — an unaccounted skip is `NEEDS WORK`, not `COMPLETE`.
    On the **fast path** (Phase 0) the gate is narrower *by design* — red→green for any behavior
    change, `clippy`/`fmt` clean, and the 5b quality pass; there is no plan or 5a stage to run.
    That earns `COMPLETE` only if Phase-0 triage genuinely held; if the change turned out
    non-trivial and the full loop was skipped anyway, that is `NEEDS WORK`, not a shortcut earned.
    Honesty bar: `${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`.
16. **Capture learnings.** Before suggesting next steps, identify anything **non-obvious
    and durable** this task produced — a design decision + rationale, a gotcha that cost
    time, a convention discovered, or a non-trivial fix. For each, run `/remember` directly
    (it writes the note to the Obsidian vault); report the resulting note path. Skip what
    the code, git history, or `Cargo.toml` already makes obvious. If nothing is durable, say
    so and move on.
17. Suggest next steps: `/review` for a deeper audit, `/perf` if perf-sensitive,
    `/changelog` if user-facing, `/publish` if it's release-bound, `/session-wrap` to close
    out the session. If running as a team,
    shut each teammate down with `SendMessage {type:"shutdown_request"}` (no `TeamDelete`).

## Error recovery
If any sub-agent returns **BLOCKED** (missing ADR, undecided design, absent dependency):
surface it immediately, do not proceed past the blocked dependency, and `AskUserQuestion`
with options — (a) skip and note the gap, (b) retry with narrower scope, (c) stop and run
the prerequisite skill (e.g. `/adr`, `/architecture`). Never discard completed work.
