---
name: team-perf
description: "measure optimize performance benchmark unsafe — harden performance and safety with the systems team (systems-perf-lead, perf-engineer, concurrency-specialist, unsafe-auditor): baseline → plan → build → validate → sign-off."
argument-hint: "[target]"
user-invocable: true
---

# /team-perf — measure, optimize, and prove the win

Orchestrate the systems-perf team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.**
Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` (§8 team execution).
Rules: `${CLAUDE_PLUGIN_ROOT}/rules/perf.md` · `${CLAUDE_PLUGIN_ROOT}/rules/unsafe.md`.

## Orchestration & progress
Execute the phases as an agent team per **`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §8**
(implicit session team, shared task list with `addBlockedBy` ordering, `SendMessage`, teammate
shutdown). Gate on `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`: if unset, fall back to
single-orchestrator delegation — spawn sub-agents sequentially and inline each phase's context
into the spawn prompt.

Keep the **task list live** when `progress_tracking` is on (`${user_config.progress_tracking}`,
default on): one `TaskCreate` per phase up front, flip to `in_progress` before each phase and
`completed` the moment it yields a result (surfaced in one line) so the user sees intermediate
progress, not a final dump. Foreground the phase being waited on. Off → no task-list narration.

## Team composition

`systems-perf-lead` (owns PERF-GATE + SAFETY-GATE) · `perf-engineer` · `concurrency-specialist`
· `unsafe-auditor` (inherit; any `unsafe` touched) · `rust-builder` (writes code + tests)
· `rust-reviewer` (diff audit).

Create one task per phase via `TaskCreate`; chain them with `addBlockedBy` (1 → 2 → 3 → 4 →
5) and assign each to its owning agent with `TaskUpdate owner`. Phase 1's four
inventory streams are independent and read-only — create them as sibling tasks (same blocker,
no dependency between them) so they run concurrently as teammates, or spawn each as a
**background subagent** (`background: true`) since none of them write. The lead synthesizes
the baseline once all four report via `SendMessage`.

## Phase 1 — Measure (baseline only; no optimization yet)

- **Recall first:** `/recall <target>` (or reuse the session-start memory index) and paste what
  binds — known hot paths, past optimization attempts and rejected ones, `unsafe` decisions —
  INTO the team spawn prompts (teammates do not inherit session context); say when a recalled
  note changes the approach. If nothing surfaces, proceed
  (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
- Task owned by `rust-scout` to locate the target crate(s), hot-path entry points, existing
  criterion benches, and any current `unsafe` blocks. Scout uses serena MCP for symbol
  navigation (`find_symbol`, `find_referencing_symbols`, `get_symbols_overview`) and `rg`
  for macro-generated or `cfg`-gated sites serena can't see. Returns a `file:line` map.
- Sibling task — `perf-engineer` runs the existing bench suite (`cargo criterion` or
  `cargo bench`) and records baseline numbers verbatim. If no criterion benches exist,
  `perf-engineer` drafts the missing bench harness and `rust-builder` writes it (tactical
  call — state approach and proceed).
- Sibling task — `concurrency-specialist` inventories lock-free structures, `Arc`/`Mutex`
  usage, and any atomics in scope.
- Sibling task — `unsafe-auditor` catalogues every `unsafe` block in scope: file, line, and
  whether a `// SAFETY:` comment is present.
- Present the baseline report: wall-clock numbers, allocation profile (if `dhat`, `heaptrack`,
  `samply`, or `flamegraph` is available), and the `unsafe` inventory. No optimization yet.
- **Gate:** `AskUserQuestion` — confirm the target(s) and accept the baseline before any
  optimization work begins.

## Phase 2 — Plan (blocked by 1)

- Task owned by `systems-perf-lead` to analyze the baseline and produce an optimization plan:
  - Ranked list of opportunities (algorithmic, allocation, data layout, SIMD, lock
    contention, cache pressure).
  - For each opportunity: predicted win (order-of-magnitude estimate), approach, and
    whether new `unsafe` will be required.
  - Identify which gate(s) apply: **PERF-GATE**, **SAFETY-GATE**, or both.
- Present **2–4 optimization strategies** with trade-offs (speed vs. maintainability vs.
  `unsafe` surface) and a recommended default.
- **Gate:** `AskUserQuestion` — this is a strategic fork; get explicit approval of the chosen
  strategy before any code is written.

## Phase 3 — Build (blocked by 2)

- Task owned by `rust-builder` with the approved plan (pass the plan in the spawn prompt —
  teammates don't inherit it). Instruct it to:
  - Work in the smallest reviewable increments — one logical change at a time.
  - Stay strictly in scope; no opportunistic refactors.
  - Run `cargo check`, `cargo clippy --all-targets --all-features -- -D warnings`, and
    `cargo fmt` after each increment; fix all warnings before moving on.
  - Add `// SAFETY:` comments to every `unsafe` block (new or pre-existing and
    comment-free). Flag any new `unsafe` explicitly in the diff summary.
- For **every new or modified `unsafe` block**, pause and hand a task to `unsafe-auditor` to
  review the invariant before `rust-builder` continues:
  - `unsafe-auditor` checks the `// SAFETY:` comment for completeness and soundness.
  - `unsafe-auditor` runs `cargo +nightly miri test` on the affected code where feasible
    and cites the output.
  - If `unsafe-auditor` raises concerns, hand them back to `rust-builder` (loop) until
    the auditor is satisfied or the approach is reconsidered.
- `rust-builder` reports a diff summary and command output after each increment.
- **Gate:** review the draft diff; `AskUserQuestion` for approval before Phase 4.

## Phase 4 — Validate (blocked by 3)

- Task owned by `perf-engineer` to re-run the full criterion bench suite. Collect
  **before/after numbers** side-by-side; do not summarize — paste the raw criterion output.
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
- For lock-free or atomic-heavy changes: hand a task to `concurrency-specialist` to run
  `cargo test` under `loom` (or equivalent) and cite the output.
- Hand a task to `rust-reviewer` to audit the full diff: correctness, clippy-cleanliness,
  doc-comment accuracy, and gate compliance.
- If **PERF-GATE** or **SAFETY-GATE** is not cleared, hand findings back to `rust-builder`
  (loop Phase 3) until both gates pass or the user decides to stop.

## Phase 5 — Sign-off (blocked by 4)

- `systems-perf-lead` produces the final summary, written to `docs/benchmark-report.md` in the
  project using `${CLAUDE_PLUGIN_ROOT}/docs/templates/benchmark-report.md` as the template. Delegate
  writing the filled-out report to `rust-builder`. Every teammate's contribution ends in
  **COMPLETE / NEEDS WORK / BLOCKED** with evidence.
- Summary must include:
  - The optimization strategy chosen and why.
  - Before/after criterion numbers (verbatim).
  - `unsafe` delta (blocks added / removed / annotated).
  - Gates passed: PERF-GATE ✓ / SAFETY-GATE ✓ (with evidence citations).
  - Any scope explicitly left out and suggested follow-up skills
    (`/dev-task`, `/perf`, `/security-audit`).
- **Persist what settled:** sweep ALL teammate verdicts for `MEMORY:` lines and run `/remember`
  for each (it dedups); `/remember` team-level decisions (proven win + why, `unsafe` calls,
  rejected strategies) too — or state "nothing durable"
  (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
- Verdict: **COMPLETE / NEEDS WORK / BLOCKED**.
- Suggest next steps: `/review` for a deeper audit, `/changelog` if user-facing,
  `/publish` if release-bound.
- If running as a team, shut each teammate down with `SendMessage {type:"shutdown_request"}`
  (no `TeamDelete` — the team is implicit).

## Error recovery

Any agent returns **BLOCKED** → surface it immediately, do not proceed past the blocker,
and `AskUserQuestion` with options: (a) skip and note the gap, (b) retry with narrower
scope, (c) stop and run the prerequisite skill (e.g. `/adr`, `/architecture`,
`/dev-task` to add missing benches). Never discard completed work or baseline numbers.

Gate failure is not a blocker — it is a loop: fix → re-validate → re-gate. Only surface
as BLOCKED when the fix itself is blocked by an external dependency.
