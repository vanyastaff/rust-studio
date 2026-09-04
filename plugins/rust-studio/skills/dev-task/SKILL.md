---
name: dev-task
description: "Use when implementing one scoped Rust feature or multi-file task end to end: scout, plan, build, test, and review."
---

# /dev-task — implement one unit of work

Run a single task through **scout → plan → plan-review → approve → build → review** — or a
**fast path** for genuinely trivial changes (Phase 0) — honoring the
collaboration protocol (`references/collaboration.md`;
`references/delegation.md` §8 team execution). You are the orchestrator: **you do not write code
or tests yourself — you delegate writes to `rust-builder` when workers are available, or run that
role inline otherwise.** Use the host's native plan/approval surface when available; otherwise
present the same plan in the conversation and obtain explicit approval. Use a user prompt only
for genuine design forks and BLOCKED recovery. Decide tactical calls yourself and state choice +
one-line rationale.

## Orchestration & progress
Run the phases (scout → plan → plan-review → build → review) using the capabilities described in
**`references/delegation.md` §8**. Parallelize independent read-only work when workers are
available; otherwise execute each named role inline and pass its result to the next phase.

Availability is not a reason to spawn. A separate process costs a brief that restates what you
already hold, a re-read on the other side, and several times the tokens — so it has to buy
either **filtering** (the worker reads far more than it returns: `rust-scout` over an
unfamiliar crate) or **independence** (the verdict must not come from the author:
`harsh-critic`, `rust-reviewer`). A few edits in a file whose contents and plan are already in
your context buys neither — run that phase inline (`references/delegation.md` §"When a handoff
earns its cost"). Skipping the *spawn* is a judgment call; skipping the *phase* is not.

When the host has a task or plan surface, keep one item per phase live and update it as results
arrive. Otherwise maintain a concise in-message checklist. At every boundary surface the result
in one line (edit-site map, plan verdict, diff summary, review findings) before moving on. The
portable skill never invokes a host-specific status-line script; a full host plugin may mirror
these phase updates separately.

## Input
`input` is the task. If it's a path, read that file. If empty, ask: "What should we
build?" and, for non-trivial work, suggest running `/architecture` or `/brainstorm` first.

## Pick the review mode
Start from the intensity the session briefing names (default **full**), then adjust to the
change: **lean** for a routine change inside one crate, **full** for public APIs, `unsafe`,
releases, or cross-crate ripples, **solo** for prototypes. Escalate freely; drop below the
configured intensity only with a stated reason. State which mode you're using and why.

Mode scales *reviewers*, never evidence — `references/verdicts.md` §"Review modes". At
`lean`/`solo` the independent lenses that would catch a gamed green are gone, so the
`stop-guard` hook defaults on there; the honesty bar below is identical in every mode.
Any non-trivial task must also apply the pre-code maintainer standard in
`references/maintainer-grade-development.md` before code is written.

## Phase 0 — Right-size the ceremony (triage first)
The most common SDD failure mode is *over-process* — turning a one-line fix into a multi-phase
plan and a spec nobody needed. Match the ceremony to the change, **never the quality bar**: a
fast path skips planning *overhead*, not tests, idiom, or review.

**Fast path** — take it only when ALL hold: a single obvious edit site (or a few mechanical
ones), no design fork, no new/changed public API, no `unsafe`, no cross-crate ripple, no new
dependency (a typo/doc fix, a localized bug with a clear cause, a serena-drivable rename). Then:
- Skip Phases 1–3 — no scout sweep or formal plan-approval gate. State one line:
  *"Fast path: <change> — <why it qualifies>."*
- Still **red→green for any behavior change**, still `clippy -D warnings` + `fmt` clean, still a
  quick `rust-reviewer` pass (Phase 5b) and a Phase 6 verdict. Quality is never on the chopping block.
- If triage proves wrong — the "one-liner" reveals a design choice, a cross-crate ripple, or a
  public-API/`unsafe` touch — **stop and enter the full loop.** Abandoning a fast path mid-task
  is correct, not failure; it's the honest move the moment a condition above stops holding.

**Full loop** — everything else (features, public-API / `unsafe` / cross-crate changes, anything
with a real design decision) runs Phases 1–6 below under the chosen review mode. This is *not* a
quick-win escape hatch: when in doubt, take the full loop.

The double-loop, observable-criteria, and full **fast-path abort protocol** are defined once in
`references/testing-model.md` — abort the fast path the moment a trivial condition
stops holding, re-enter the full loop, and reuse (don't discard) the work already done.

## Phase 1 — Scope & locate
**Recall first:** `/recall <task area>` (or reuse the session-start memory index if it already
surfaced this area) and carry prior decisions and gotchas into the plan; say when a recalled note
changes the approach. If nothing surfaces, proceed
(`references/memory-protocol.md`).
0. **Open the planning surface when available.** Use the host's native plan UI/file for the
   read-only scout and planning phases. If none exists, keep the draft in the conversation. A
   user prompt is allowed for genuine design forks (Phase 2 step 7); no code is written before
   the Phase 3 approval gate.
1. Restate the task as **acceptance criteria in observable form** — given/when/then, or
   input → effect → edge case. Enumerate the scenarios the behavior **really** has: the happy path
   **plus** error paths, boundaries, and (for async) concurrency/cancellation — happy-path-only is
   under-thought (`references/testing-model.md`). Don't pad with contrived cases
   either — that's the Phase-0 over-specification failure; cover the real cases, no more. Confirm
   with the user if fuzzy.
   Where the change has an **externally observable behavior**, write the **outer acceptance test**
   now (the highest-level test that asserts the feature from outside) and confirm it **fails** (red).
   This is the outer loop of a double loop: the acceptance test pins "done from the outside", and
   Phase 4's unit-level TDD drives inward to make it pass. Pure internal refactors with no external
   behavior change skip the acceptance test — their existing unit tests are the anchor.
2. Task owned by **`rust-scout`** to map the edit sites and existing tests. Don't guess the
   layout. Scout uses serena MCP for symbol/reference navigation and `rg` for macro-generated
   or `cfg`-gated sites serena can't see — never Bash `grep`/`find`. (As a teammate, scout
   relies on the user's ambient serena — it is not bundled into the spawn.)
3. Identify the owning lead from the domain (see `references/agent-roster.md`).

## Phase 2 — Plan (blocked by scout)
4. Task owned by the **owning lead** (e.g. `api-design-lead`, `async-systems-lead`) — or
   `chief-architect` if the design is non-trivial — to produce a short plan: files to
   change, the approach, test strategy, risks, and which gate(s) apply.
5. Require a **Maintainer-grade pre-code verdict** from
   `references/maintainer-grade-development.md`: `ACCEPTABLE`,
   `RESHAPE NEEDED`, or `BLOCKED`. The verdict must cover crate ownership, sibling-crate
   reuse, ecosystem/current-doc checks where relevant, API/type-system shape, performance
   posture, active-dev breaking-change policy, and likely strict-maintainer rejection reasons.
6. If the verdict is `RESHAPE NEEDED`, reshape the plan before build. Do not let builder write
   the junior local patch and rely on review to fix it afterward. If the reshape changes
   product scope or creates an irreversible/outward action, surface the fork for approval.
7. If the plan reveals a real design decision, present 2–4 options with trade-offs.
8. **Write the plan into the host's plan surface, or present it in the conversation**, building it
   incrementally. Consolidate the lead's
   plan (files to change, approach, test strategy, risks, applicable gates) **and** the
   `ACCEPTABLE / RESHAPE NEEDED / BLOCKED` maintainer verdict into it. Keep mirroring each
   phase's one-line result to the task list as before (progress visibility is unchanged).

## Phase 2.5 — Plan review (adversarial gate, before approval)
The lead's maintainer verdict in Phase 2 is a *self*-check; this gate adds an **independent**
adversarial pass so a flawed plan is caught **before any code is written**, not after. Reviewers
are read-only — they attack the PLAN, never edit. Scale the depth to the **review mode** chosen
above:
- **solo** — run it only when the plan is boundary-moving (public API, `unsafe`, cross-crate, a
  new dependency, or data/migration). Then spawn `harsh-critic` to attack the plan; otherwise
  state *"solo: plan-review skipped — localized change, no boundary"* and proceed.
- **lean** — always spawn `harsh-critic` for one adversarial pass over the plan.
- **full** — spawn `harsh-critic` **plus** the relevant domain reviewer as a concurrent second
  lens, chosen by what the plan touches: `unsafe-auditor` (any `unsafe`/FFI), `security-auditor`
  (untrusted input, auth, deserialization), `api-design-lead` (public surface / semver), or
  `systems-perf-lead` (hot path / allocation). Run them as sibling tasks / background subagents
  (read-only, so they parallelize).

Reviewers target the plan, not code: wrong or oversized decomposition, a simpler approach
missed, an unhandled failure/edge case, a boundary/semver hazard, an ownership/sibling-reuse
miss. Each returns **ACCEPTABLE / RESHAPE NEEDED / BLOCKED** with concrete reasons (no praise).
**Gate:** any `RESHAPE NEEDED` → fold the findings in and loop back to Phase 2 to rewrite the
plan before approval; any `BLOCKED` → stop and surface the blocker. Only a plan that
survives this pass reaches Phase 3 — the user approves a design that has already been reviewed.

## Phase 3 — Approve (gate)
9. **Request explicit approval through the host's plan surface.** If the host has no plan UI,
   present the complete plan in chat and ask for approval there. Include the build commands the
   plan needs (for example tests, clippy, and fmt). If the user rejects or requests changes,
   loop back to Phase 2 and rewrite the plan in the same surface.

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
    Honesty bar: `references/integrity-and-evidence.md`.
16. **Capture learnings.** Before suggesting next steps, identify anything **non-obvious
    and durable** this task produced — a design decision + rationale, a gotcha that cost
    time, a convention discovered, or a non-trivial fix. For each, run `/remember` directly
    (it writes the note to the project memory store); report the resulting note path. Skip what
    the code, git history, or `Cargo.toml` already makes obvious. If nothing is durable, say
    so and move on. Also sweep every agent verdict for `MEMORY:` lines and run `/remember`
    for each (it dedups) — canonical rule: `references/memory-protocol.md`.
17. Suggest next steps: `/review` for a deeper audit, `/perf` if perf-sensitive,
    `/changelog` if user-facing, `/publish` if it's release-bound, `/session-wrap` to close
    out the session. If running as a team,
    close any workers through the host's lifecycle API when one exists.

## Error recovery
If any sub-agent returns **BLOCKED** (missing ADR, undecided design, absent dependency):
surface it immediately, do not proceed past the blocked dependency, and prompt the user
with options — (a) skip and note the gap, (b) retry with narrower scope, (c) stop and run
the prerequisite skill (e.g. `/adr`, `/architecture`). Never discard completed work.
