---
name: tdd
description: "Implement a behavior test-first through RED -> GREEN -> REFACTOR — write the smallest failing test, the minimal code to pass, then refactor with tests green. Use to build a feature or fix a bug with a test driving each step."
argument-hint: "[behavior / bug to implement]"
user-invocable: true
---

# /tdd — RED → GREEN → REFACTOR

Drive one behavior at a time test-first. The discipline is the point — don't write
implementation before a failing test exists. Protocol:
`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`; standards: `rules/testing.md`, `rules/core.md`.

**Maintainer bar applies.** The GREEN code is held to
`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`: the first draft is idiomatic,
allocation-aware, and borrow-correct — passing the test is the floor, not the bar. The GREEN
spawn carries the pre-code verdict (`ACCEPTABLE` / `RESHAPE NEEDED` / `BLOCKED`); if the only
way to pass is a wrong-crate or clone-to-appease shape, that is `RESHAPE NEEDED`, not later cleanup.

## Per behavior, loop these three phases

### 🔴 RED — a failing test
1. State the one behavior in a sentence (input → expected output / effect, incl. an edge case).
2. Spawn `test-engineer` (or write directly) to add the **smallest** test that captures it —
   unit, integration, or a `proptest` law. Don't test more than this one behavior.
3. Run `cargo nextest run <name>` (fall back to `cargo test <name>`) and **confirm it fails
   for the right reason** — asserts the behavior, not a compile error you didn't intend.
   If it passes already, the behavior exists; pick the next one. Don't proceed to GREEN
   until the failure is the expected assertion.

### 🟢 GREEN — minimal code to pass
4. Spawn `rust-builder` to write the **least CORRECT, idiomatic, allocation-aware,
   borrow-correct** code that makes the test pass — minimality is textual scope, NOT a license
   for non-idiomatic or clone-to-appease shapes. No speculative generality, but the first draft
   meets the maintainer bar; do NOT defer idiom/perf/borrow quality to the REFACTOR step. If it
   won't compile, `rust-build-resolver` / `/fix-build`.
5. Run the test until green; run `cargo nextest run` (or `cargo test`) to confirm no regressions.

### 🔧 REFACTOR — clean with tests green
6. With the bar green, improve names/structure/duplication (`rust-builder`); re-run after each
   step so it stays green. `cargo clippy --all-targets --all-features -- -D warnings` and `cargo fmt`.
7. `rust-reviewer` audits the diff.

Repeat for the next behavior. Use `/verify-loop` to drive the run→fix→re-run cycle.

## Guardrails
- Never weaken or `#[ignore]` a test to go green — fix the code.
- One behavior per cycle; small steps. Keep the suite green between behaviors.

## Output
Per behavior: the test added, the code that passed it, and the green run. End with verdict
**COMPLETE / NEEDS WORK / BLOCKED**. Hand off to `/review`, `/commit`.
