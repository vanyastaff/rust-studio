---
name: team-perf
description: "measure optimize performance benchmark unsafe — harden performance and safety with the systems team (systems-perf-lead, perf-engineer, concurrency-specialist, unsafe-auditor): baseline → plan → build → validate → sign-off."
argument-hint: "[target]"
user-invocable: true
---

# /team-perf — measure, optimize, and prove the win

Orchestrate the systems-perf team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.**
Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`.
Rules: `${CLAUDE_PLUGIN_ROOT}/rules/perf.md` · `${CLAUDE_PLUGIN_ROOT}/rules/unsafe.md`.

**No change lands without numbers.** Every claim of "faster" or "safer" must be backed by
criterion before/after output or `cargo miri` evidence (see §7 of the coordination protocol).

Decide tactical calls yourself — state the choice + one-line rationale and proceed.
Gate with `AskUserQuestion` only at genuine strategic forks and before outward/irreversible
actions (push, PR, publish).

## Team composition

`systems-perf-lead` (owns PERF-GATE + SAFETY-GATE) · `perf-engineer` · `concurrency-specialist`
· `unsafe-auditor` (opus; any `unsafe` touched) · `rust-builder` (writes code + tests)
· `rust-reviewer` (diff audit).

## Phase 1 — Measure (baseline only; no optimization yet)

- Spawn `rust-scout` to locate the target crate(s), hot-path entry points, existing
  criterion benches, and any current `unsafe` blocks. Scout uses serena MCP for symbol
  navigation (`find_symbol`, `find_referencing_symbols`, `get_symbols_overview`) and `rg`
  for macro-generated or `cfg`-gated sites serena can't see. Returns a `file:line` map.
- Spawn `perf-engineer` to run the existing bench suite (`cargo criterion` or `cargo bench`)
  and record baseline numbers verbatim. If no criterion benches exist, `perf-engineer` drafts
  the missing bench harness and `rust-builder` writes it (tactical call — state approach and
  proceed).
- Spawn `concurrency-specialist` to inventory lock-free structures, `Arc`/`Mutex` usage,
  and any atomics in scope.
- Spawn `unsafe-auditor` to catalogue every `unsafe` block in scope: file, line, and
  whether a `// SAFETY:` comment is present.
- Present the baseline report: wall-clock numbers, allocation profile (if `dhat`, `heaptrack`,
  `samply`, or `flamegraph` is available), and the `unsafe` inventory. No optimization yet.
- **Gate:** `AskUserQuestion` — confirm the target(s) and accept the baseline before any
  optimization work begins.

## Phase 2 — Plan

- Spawn `systems-perf-lead` to analyze the baseline and produce an optimization plan:
  - Ranked list of opportunities (algorithmic, allocation, data layout, SIMD, lock
    contention, cache pressure).
  - For each opportunity: predicted win (order-of-magnitude estimate), approach, and
    whether new `unsafe` will be required.
  - Identify which gate(s) apply: **PERF-GATE**, **SAFETY-GATE**, or both.
- Present **2–4 optimization strategies** with trade-offs (speed vs. maintainability vs.
  `unsafe` surface) and a recommended default.
- **Gate:** `AskUserQuestion` — this is a strategic fork; get explicit approval of the chosen
  strategy before any code is written.

## Phase 3 — Build

- Spawn `rust-builder` with the approved plan. Instruct it to:
  - Work in the smallest reviewable increments — one logical change at a time.
  - Stay strictly in scope; no opportunistic refactors.
  - Run `cargo check`, `cargo clippy --all-targets --all-features -- -D warnings`, and
    `cargo fmt` after each increment; fix all warnings before moving on.
  - Add `// SAFETY:` comments to every `unsafe` block (new or pre-existing and
    comment-free). Flag any new `unsafe` explicitly in the diff summary.
- For **every new or modified `unsafe` block**, pause and spawn `unsafe-auditor` to
  review the invariant before `rust-builder` continues:
  - `unsafe-auditor` checks the `// SAFETY:` comment for completeness and soundness.
  - `unsafe-auditor` runs `cargo +nightly miri test` on the affected code where feasible
    and cites the output.
  - If `unsafe-auditor` raises concerns, hand them back to `rust-builder` (loop) until
    the auditor is satisfied or the approach is reconsidered.
- `rust-builder` reports a diff summary and command output after each increment.
- **Gate:** review the draft diff; `AskUserQuestion` for approval before Phase 4.

## Phase 4 — Validate

- Spawn `perf-engineer` to re-run the full criterion bench suite. Collect **before/after
  numbers** side-by-side; do not summarize — paste the raw criterion output.
- **PERF-GATE** (`systems-perf-lead`):
  - Hot paths are allocation-aware; no needless clones introduced.
  - Measured win meets or exceeds the predicted win from Phase 2, or the shortfall is
    explained and accepted.
  - Complexity of new code is justified by the numbers.
- **SAFETY-GATE** (`systems-perf-lead` + `unsafe-auditor`):
  - Every `unsafe` block (old and new) has a correct `// SAFETY:` invariant.
  - `cargo +nightly miri test` is clean for all affected paths (cite output; if miri is
    infeasible for a path, state why explicitly).
  - No new `unsafe` surface was added beyond what was approved in Phase 2.
- For lock-free or atomic-heavy changes: spawn `concurrency-specialist` to run
  `cargo test` under `loom` (or equivalent) and cite the output.
- Spawn `rust-reviewer` to audit the full diff: correctness, clippy-cleanliness,
  doc-comment accuracy, and gate compliance.
- If **PERF-GATE** or **SAFETY-GATE** is not cleared, hand findings back to `rust-builder`
  (loop Phase 3) until both gates pass or the user decides to stop.

## Phase 5 — Sign-off

- `systems-perf-lead` produces the final summary using
  `${CLAUDE_PLUGIN_ROOT}/docs/templates/benchmark-report.md` as the template. Delegate
  writing the filled-out report to `rust-builder`.
- Summary must include:
  - The optimization strategy chosen and why.
  - Before/after criterion numbers (verbatim).
  - `unsafe` delta (blocks added / removed / annotated).
  - Gates passed: PERF-GATE ✓ / SAFETY-GATE ✓ (with evidence citations).
  - Any scope explicitly left out and suggested follow-up skills
    (`/dev-task`, `/perf`, `/security-audit`).
- Verdict: **COMPLETE / NEEDS WORK / BLOCKED**.
- Suggest next steps: `/review` for a deeper audit, `/changelog` if user-facing,
  `/publish` if release-bound.

## Error recovery

Any agent returns **BLOCKED** → surface it immediately, do not proceed past the blocker,
and `AskUserQuestion` with options: (a) skip and note the gap, (b) retry with narrower
scope, (c) stop and run the prerequisite skill (e.g. `/adr`, `/architecture`,
`/dev-task` to add missing benches). Never discard completed work or baseline numbers.

Gate failure is not a blocker — it is a loop: fix → re-validate → re-gate. Only surface
as BLOCKED when the fix itself is blocked by an external dependency.
