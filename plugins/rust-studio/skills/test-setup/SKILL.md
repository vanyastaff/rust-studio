---
name: test-setup
description: Wire up the test toolchain with test-engineer — proptest, criterion, nextest, and coverage.
user-invocable: true
---

# /test-setup — wire up the test toolchain

Bootstrap the project's testing infrastructure end-to-end: property tests, benchmarks,
snapshot tests (optional), a nextest runner config, and a coverage path via
`cargo-llvm-cov`. You are the orchestrator: **you do not write files yourself — you
delegate all writes to `rust-builder`.** Gate with `AskUserQuestion` only at phase
boundaries (scope, plan approval, BLOCKED recovery) — decide tactical calls yourself,
state choice + one-line rationale. See `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`.

## Phase 1 — Clarify scope

1. `AskUserQuestion` (batch in one ask):
   - Which crates/workspace members need test infrastructure?
   - Is `insta` (snapshot testing) wanted, or proptest + criterion only?
   - What coverage threshold should CI enforce (e.g. 80 %)?
   - Does the project already have a `.cargo/nextest.toml` or `Cargo.toml`
     `[profile.test]` block that would conflict?

2. Spawn **`rust-scout`** to locate existing test files, bench files, dev-dependencies,
   and any current nextest or coverage config. Scout uses serena MCP for symbol/file
   navigation and `rg` for config-gated or generated sites serena can't see — never
   Bash `grep`/`find`. Don't guess the layout.

## Phase 2 — Plan

3. Spawn **`test-engineer`** (owns this domain; Quality tier, see
   `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md`) with the scout's map and the user's
   answers. Instruct `test-engineer` to produce:
   - Dev-dependency additions: `proptest`, `criterion`, and optionally `insta`.
   - A nextest configuration: `[profile.default]` timeouts, thread counts, and
     `retries` for flaky-test detection.
   - A coverage plan: `cargo-llvm-cov` invocation flags (e.g. `--lcov`, `--html`,
     `--fail-under-lines <threshold>`).
   - Skeleton file list: paths for `tests/<crate>/` integration stubs and
     `benches/<crate>.rs` criterion harnesses.
   - References to `${CLAUDE_PLUGIN_ROOT}/rules/testing.md` for the project's
     property-test and bench conventions.

4. Decide tactical choices yourself (e.g. shared vs crate-local proptest `Strategy`
   module: pick the simpler option and state why). Only escalate genuine design forks
   — direction-changing, not resolvable by ecosystem convention — as 2–4 options with
   a recommended default.

## Phase 3 — Approve (gate)

5. `AskUserQuestion`: show `test-engineer`'s plan as a structured list (deps to add,
   files to create, config to write). Get explicit sign-off before any file is touched.
   If the user requests changes, loop back to Phase 2.

## Phase 4 — Build

6. Spawn **`rust-builder`** with the approved plan. Instruct it to:
   - Add dev-deps to the correct `[dev-dependencies]` blocks (workspace root or
     per-crate, whichever applies).
   - Write `.cargo/nextest.toml` (create if absent) with the agreed profile.
   - Write the `tests/` skeleton: one integration test stub per target crate,
     following `${CLAUDE_PLUGIN_ROOT}/rules/testing.md`.
   - Write the `benches/` skeleton: one criterion harness stub per target crate,
     following `${CLAUDE_PLUGIN_ROOT}/rules/perf.md`.
   - Add a `[profile.bench]` override in `Cargo.toml` if criterion requires it.
   - Record the `cargo-llvm-cov` invocation in a CI helper script or a `[alias]`
     in `.cargo/config.toml` — whichever the user preferred in Phase 1.
   - Respect all conventions in `${CLAUDE_PLUGIN_ROOT}/rules/testing.md`.
   - Run `cargo check --tests --benches`, `cargo nextest run`, and
     `cargo clippy --all-targets --all-features -- -D warnings`; fix any issues.

7. `rust-builder` reports a diff summary and command output. Show it to the user.

## Phase 5 — QA gate

8. Spawn **`qa-lead`** to clear `QA-GATE`:
   - Stubs compile and nextest discovers them.
   - No test is unconditionally `#[ignore]`d without a tracking comment.
   - Coverage invocation is reproducible (`cargo llvm-cov --tests -- --test-threads 1`
     or equivalent).
   - `test-engineer` confirms proptest and criterion APIs match `rules/testing.md`.

9. If `QA-GATE` finds issues, hand them back to `rust-builder` (loop Phase 4) until
   clean or the user decides to stop.

## Phase 6 — Verdict and hand-off

10. Summarize what was wired up: dep versions, files created, nextest profile,
    coverage alias/script, and the QA-GATE evidence.

11. End with **COMPLETE / NEEDS WORK / BLOCKED**.

12. Suggest next steps:
    - `/coverage` to run the full coverage report and view the HTML output.
    - `/dev-task` to implement the first real property test or benchmark.
    - `/review` if CI config was also modified and needs an audit pass.

## Error recovery

If **`rust-builder`** is BLOCKED (e.g. a workspace feature flag prevents `criterion`
from building, or `cargo-llvm-cov` is not installed), surface the blocker immediately.
Do not proceed past it. `AskUserQuestion` with options: (a) resolve the prerequisite
(`cargo install cargo-llvm-cov`), (b) skip that tool and note the gap, or (c) stop.
Never discard work that already landed cleanly.
