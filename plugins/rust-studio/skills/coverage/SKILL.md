---
name: coverage
description: "coverage report gaps llvm-cov tarpaulin — measure test coverage, surface meaningful uncovered paths, and close them with targeted tests."
argument-hint: "[optional package]"
user-invocable: true
---

# /coverage — measure coverage and close meaningful gaps

Run coverage tooling, surface the gaps that actually matter, and hand off concrete
test suggestions to `qa-lead`. You are the orchestrator: **you do not write tests
yourself — you delegate writes to `rust-builder`.**
Honor the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

## Input

`$ARGUMENTS` may be a package name (`-p my-crate`) or empty (whole workspace). If
empty, run coverage on the full workspace; if the workspace is large (>10 crates),
default to `--all` but note the scope and proceed — do not stop to ask.

## Phase 1 — Instrument

1. Prefer **`cargo llvm-cov`**; fall back to **`cargo tarpaulin`** if llvm-cov is not
   installed. State which tool is used and why.
2. Run coverage (read-only; no approval needed per protocol §1):
   - llvm-cov: `cargo llvm-cov --all-features --workspace [--package <pkg>] --lcov --output-path lcov.info && cargo llvm-cov report`
   - tarpaulin: `cargo tarpaulin --all-features --workspace [--packages <pkg>] --out Lcov`
3. If the run fails (missing tool, linker error, proc-macro conflict), surface the
   exact error, explain the likely cause, and offer:
   - (a) install the missing tool and retry,
   - (b) fall back to the other tool,
   - (c) use `cargo test` line-count heuristics only (advisory, clearly labeled).

## Phase 2 — Report

4. Show the **overall workspace/crate percentage** and a **per-module table**:

   ```
   Module                  Lines    Branches   Uncovered
   -------------------------------------------------------
   crate::auth             87 %     74 %        38 lines
   crate::http::client     61 %     51 %        92 lines
   ...
   ```

5. Identify the **most important uncovered regions** — prioritize in this order:
   - **Error paths** — `Err(...)` arms, `?` propagation, panics.
   - **Boundary conditions** — empty inputs, max sizes, off-by-one sites.
   - **State transitions** — enum variant arms, match exhaustiveness.
   - **Public API surface** — every exported function/method.
   - Deprioritize: generated code, `#[cfg(test)]` helpers, trivial getters, `Display`/`Debug` impls.

6. Present a ranked gap list (top 10 max, fewer if the picture is clean):

   ```
   path:line  🔵 TEST-GAP: <uncovered behavior> — <why it matters>.
   ```

## Phase 3 — Consult qa-lead

7. Spawn **`qa-lead`** with the gap list and the full coverage report. Instruct it to:
   - validate which gaps represent real behavioral risk vs. noise,
   - draft concrete test stubs (function name, inputs, expected outcome) for the top gaps,
   - flag any flakiness risks in proposed tests.

## Phase 4 — Decision gate

8. `AskUserQuestion`: show the ranked gaps and `qa-lead`'s proposed test stubs. Ask:
   - Which gaps to address in this session?
   - Accept the default priority order, or reprioritize?
   - Any gaps to explicitly skip (e.g. "we own this risk")?

   Do not proceed to Phase 5 until the user answers.

## Phase 5 — Hand off

9. For each approved test, spawn **`rust-builder`** with:
   - the exact file and line range to cover,
   - the test stub from `qa-lead`,
   - instructions to run `cargo nextest run` (fall back: `cargo test`) and confirm the
     new test passes and coverage for that region increases.
10. After each build, report the delta: new coverage percentage and remaining gap count.

## Phase 6 — Verdict

11. Re-run coverage to confirm the delta. Show the updated per-module table.
12. Summarize:
    - Coverage before and after (overall and per module touched).
    - Gaps closed vs. gaps left out of scope (with rationale).
    - Evidence: paste the llvm-cov/tarpaulin summary line.
13. End with **COMPLETE / NEEDS WORK / BLOCKED**.
14. Suggest next steps: `/test-plan` to formalize the test strategy, `/review` for a
    pre-merge audit, `/dev-task` if a gap reveals missing behavior.

## Coverage targets

Do **not** chase 100%. The goal is **meaningful coverage of behavior**:
- Error paths and public API: aim for ≥ 80 % branch coverage.
- Internal helpers: line coverage ≥ 70 % is a reasonable floor.
- Below-floor modules warrant a comment in the gap list, not panic.
- Celebrate closed error-path gaps more than closed trivial-getter gaps.
- Coverage measures **execution, not correctness**: a line covered only by a vacuous test
  (`is_ok()` with no value check, a tautology) is not tested — flag it, don't bank it as covered
  behavior. Report the real denominator: `#[ignore]`-d / skipped tests don't inflate the number;
  if cases are excluded, say so. Honesty bar: `${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`.

## Error recovery

If `rust-builder` returns **BLOCKED** (e.g. the test requires a live DB or network):
surface it immediately, do not skip silently, and offer:
- (a) mock the dependency and retry,
- (b) mark the gap as "needs integration test" and note it out of scope for this session,
- (c) run `/dev-task` to introduce the test infrastructure first.
Never discard a partially completed coverage run.
