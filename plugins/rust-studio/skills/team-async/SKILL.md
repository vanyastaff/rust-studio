---
name: team-async
description: "async service feature design ship build — orchestrate the async team (async-systems-lead, async-runtime-specialist, web-framework-specialist, database-specialist, observability-engineer) through design, build, and review end-to-end."
argument-hint: "[feature]"
user-invocable: true
---

# /team-async — design & ship an async service feature

Orchestrate the async team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.** Gate at phase boundaries (quality gates,
not permission loops — see `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §1, §8).

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
`async-systems-lead` (owns ASYNC-GATE) · `async-runtime-specialist` · `web-framework-specialist`
· `database-specialist` · `observability-engineer` · `rust-scout` (locates) · `rust-builder` (writes) · `rust-reviewer` (audits).

Create one task per phase via `TaskCreate`; chain them with `addBlockedBy` (1 → 2 → 3 → 4 →
5 → 6) and assign each to its owning agent with `TaskUpdate owner`. Where a phase fans out
across specialists, create sibling tasks (same blocker, no dependency between them) so they
run concurrently as teammates; the lead synthesizes when all report via `SendMessage`.

## Phase 1 — Scope & scout
- Restate the feature and its acceptance criteria in 1–3 bullets. If `$ARGUMENTS` is empty,
  ask: "What async service feature should we build?" and suggest `/architecture` or
  `/brainstorm` for broad explorations.
- Task owned by **`rust-scout`** to map existing async infrastructure: entry-points, runtime
  initialization, handler registration, connection pools, middleware chains, and existing
  tests. Scout uses serena MCP for symbol/reference navigation and `rg` for macro-generated
  or `cfg`-gated sites — never Bash `grep`/`find`. (As a teammate, scout uses the user's
  ambient serena — it is not bundled into the spawn.)

## Phase 2 — Design (blocked by 1)
- Task owned by `async-systems-lead` (with `async-runtime-specialist`) to draft the runtime
  topology: executor strategy (Tokio runtime shape, worker threads, `LocalSet` if needed),
  spawning model (`tokio::spawn` vs. structured tasks), and cancellation model.
- Sibling task — `web-framework-specialist` sketches the endpoint surface: routes,
  request/response types, middleware chain, and error response shape.
- Sibling task — `database-specialist` drafts the data flow: connection pool configuration,
  query patterns, and transaction boundaries at the async boundary.
- Present **2–4 design approaches** with trade-offs (simplicity vs. scalability, monolithic
  handler vs. actor model, connection-per-request vs. pooled, etc.).
- **Gate:** `AskUserQuestion` — show options, get direction on runtime topology and endpoint
  approach. Decide tactical details (channel sizes, field names, error variants) yourself;
  state choice + one-line rationale and proceed.

## Phase 3 — Architecture check (blocked by 2)
- `async-systems-lead` confirms boundaries with `chief-architect` if the feature spans
  crates, introduces a new binary entry-point, or changes the runtime configuration shared
  by other subsystems.
- Record an ADR (`/adr`) for non-trivial decisions (e.g. runtime flavor, actor vs.
  direct-await, backpressure strategy).
- Draft the async service design doc (`${CLAUDE_PLUGIN_ROOT}/docs/templates/architecture.md`).
- **Gate:** `AskUserQuestion` — present the design doc summary; proceed once approved.

## Phase 4 — Build (blocked by 3; parallel where independent)
- `rust-builder` implements all components under direction of `async-systems-lead` — all
  writes go through it. Instruct the builder to:
  - work test-driven where practical (failing test → implement → refactor),
  - stay strictly in scope (no opportunistic refactors),
  - add `// SAFETY:` notes to any `unsafe` and flag it for `unsafe-auditor`.
- Parallelize independent work streams where the design permits — create one sibling task per
  stream so they run concurrently; each specialist drives, `rust-builder` writes:
  - **Handlers/routes** — `web-framework-specialist` drives; `rust-builder` writes the
    handler functions, extractors, middleware, and error-response mapping.
  - **Database layer** — `database-specialist` drives; `rust-builder` writes the query
    functions, pool initialization, and transaction wrappers.
  - **Instrumentation** — `observability-engineer` drives; `rust-builder` writes tracing
    spans, structured log fields, and metric counters/histograms.
- Each stream reports a diff summary via `SendMessage` when complete. Hold all diffs until the
  parallel streams finish, then present them together.
- **Gate:** `AskUserQuestion` — show the combined draft diff before proceeding to validation.

## Phase 5 — Validate (blocked by 4)
- `rust-reviewer` audits the full diff.
- `async-systems-lead` runs the **ASYNC-GATE** checklist:
  - No blocking operations (I/O, `std::thread::sleep`, mutex-held-across-await, `block_on`)
    inside async contexts — cite file:line for any found.
  - All spawned tasks are cancellation-safe or documented as not-safe with a clear rationale.
  - `Send` + `'static` bounds are correct on every spawned future; no `Rc`/non-`Send` types
    leak across await points.
  - Backpressure is considered on every channel and connection pool; unbounded channels are
    explicitly justified.
  - Timeout and deadline propagation is present at service boundaries.
- Run and cite the output of:
  - `cargo nextest run` (fall back to `cargo test`) including any async integration tests.
  - `cargo clippy --all-targets --all-features -- -D warnings`.
  - `cargo fmt --check`.
- If `unsafe` was introduced, spawn `unsafe-auditor` and require SAFETY-GATE clearance.
- If findings are NEEDS WORK, hand them back to `rust-builder` (loop Phase 4) until clean or
  the user decides to stop.

## Phase 6 — Sign-off (blocked by 5)
- Summary: the final handler surface, runtime topology chosen, database layer design,
  observability instrumentation added, ASYNC-GATE status, and test evidence. Every teammate's
  contribution ends in **COMPLETE / NEEDS WORK / BLOCKED** with evidence.
- Verdict **COMPLETE / NEEDS WORK / BLOCKED**. Next steps: `/review` for a deeper audit,
  `/perf` if latency or throughput is sensitive, `/changelog` if user-facing, `/publish` if
  release-bound.
- If running as a team, shut each teammate down with `SendMessage {type:"shutdown_request"}`
  (no `TeamDelete` — the team is implicit).

## Error recovery
Any agent returns **BLOCKED** → surface it, don't proceed past it (its dependent tasks stay
blocked), `AskUserQuestion` (skip & note / retry narrower / stop and run the prerequisite).
Keep completed work.
