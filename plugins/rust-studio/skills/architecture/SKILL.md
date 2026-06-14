---
name: architecture
description: "Design or revise module/crate architecture — boundaries, dependency direction, key types, and an architecture doc. Drives map → decide → record → hand off via chief-architect."
argument-hint: "[scope/goal]"
user-invocable: true
---

# /architecture — design or revise the crate/module structure

Drive a disciplined architecture session through **map → decide → record → approve → hand off**,
honoring the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You
are the orchestrator: **you do not write files directly — you delegate all writes to sub-agents.**

## Input
`$ARGUMENTS` is the scope or goal. If it names a crate, module, or feature, start there. If it
names a path, read that file as the brief. If empty, ask: "What are we designing — a new crate,
a module reorganization, or a specific subsystem?" and, for greenfield work, suggest describing
the key use-cases before proceeding.

## Phase 1 — Map the current structure
1. Spawn **`rust-scout`** to produce a `file:line` map of all crate roots (`Cargo.toml`),
   `lib.rs` / `main.rs` entry points, `pub use` re-exports, and existing module boundaries in
   scope. Use **serena** (`find_symbol`, `get_symbols_overview`, `search_for_pattern`) for symbol
   and boundary navigation; use **`cargo modules`** to render the module tree; use **`rg`** for
   macro-generated or `cfg`-gated sites serena can't see. Do not guess the layout.
2. Spawn **`chief-architect`** (read-only) to review the scout's map and name:
   - current layering order (e.g. `domain → infra → app`),
   - obvious layering violations or circular dependencies,
   - missing or unnamed boundaries.
3. Present the map as a concise table or list (crate/module, role, known issues). If something
   looks clearly wrong or out of scope, note it and proceed — ask only if the scope itself is
   genuinely ambiguous.

## Phase 2 — Identify real decisions
4. **`chief-architect`** identifies the design questions that actually need answering (e.g.
   split vs. merge a crate, which crate owns a type, visibility rules, async boundary placement).
   Narrow to the 2–5 decisions that drive everything else.
5. For each decision, present **2–4 options** with concrete trade-offs (coupling, compile time,
   reuse, `pub` surface, maintainability). Use **exa** (`web_search_exa`, `get_code_context_exa`)
   for crates.io adoption data, peer-project patterns, and RUSTSEC evidence where relevant.
   Mark the architect's recommended default. For a load-bearing decomposition, spawn
   **`harsh-critic`** to attack the recommended option (challenge the premise, propose a
   radically different decomposition) — let the design survive only if it beats the
   alternatives, then fold real findings in.

## Phase 3 — Decide (gate)
6. `AskUserQuestion`: show the decision list and options; get explicit choices before any draft
   is produced. Batch all open decisions into one ask. If the user defers a decision, record it
   as `OPEN` and proceed only with the settled ones.
7. If a decision requires an Architecture Decision Record, note it here — it will be written in
   Phase 5 via `/adr`.

## Phase 4 — Draft the architecture
8. **`chief-architect`** drafts a module/crate diagram and prose description covering:
   - crate/module names and their single responsibility,
   - dependency direction (arrows must be acyclic),
   - key public types and traits at each boundary,
   - what is explicitly **not** in scope (anti-corruption boundaries).
9. Present the draft. State the key choices made and their rationale. If the draft reveals a
   new direction-changing fork, escalate; otherwise proceed to Phase 5.

## Phase 5 — Record decisions and docs (gate)
10. For each decision marked for an ADR in Phase 3, spawn `/adr` with the decision context,
    options, and chosen outcome. Do not write ADRs inline — delegate to the `/adr` skill.
11. Present the finished architecture draft as the terminal "here's the plan — build it?" gate
    for the user to approve using native plan mode (on approval the user transitions into an edit
    mode). Keep `AskUserQuestion` for the earlier option forks (the Phase 3 decision gate), not
    for this final go-ahead. If approved, delegate to **`rust-builder`** to write
    `docs/templates/architecture.md` (`${CLAUDE_PLUGIN_ROOT}/docs/templates/architecture.md`)
    from the approved draft. The builder must not add content beyond what was approved in Phase 4.
12. Show the committed doc path and a diff summary.

## Phase 6 — ARCH-GATE
13. Spawn **`chief-architect`** to run `ARCH-GATE` against the final architecture doc and the
    scout's map:
    - Module/crate boundaries are sound and non-overlapping.
    - Dependency direction is acyclic and documented.
    - An ADR exists for every non-trivial design choice.
    - No layering violations remain (or they are explicitly deferred with a tracking note).
14. If `ARCH-GATE` returns **NEEDS WORK**, list the specific gaps, hand them back to
    `chief-architect` for revision (loop to Phase 4), and re-run the gate.
15. If `ARCH-GATE` returns **BLOCKED** (e.g. an open external dependency), surface the blocker,
    do not proceed, and `AskUserQuestion` with options: (a) defer and document the gap, (b) scope
    down to what is unblocked, (c) resolve the dependency first.

## Phase 7 — Hand off
16. Once `ARCH-GATE` is **COMPLETE**, spawn **`product-steward`** with:
    - the approved architecture doc path,
    - the list of settled decisions and any open items,
    - a prompt to break the design into implementable stories for `/dev-task`.
17. Summarize to the user: decisions made, ADRs written, doc location, open items (if any), and
    the first suggested `/dev-task` to kick off implementation.
18. Suggest next steps: `/dev-task` for the first story, `/review` after an initial implementation,
    `/perf` if performance boundaries were a driver.

## Error recovery
If any sub-agent returns **BLOCKED** (missing context, unresolved dependency, conflicting
constraints): surface it immediately, do not proceed past the blocked item, and `AskUserQuestion`
with options — (a) narrow scope and continue, (b) gather missing context and retry, (c) stop and
resolve the prerequisite. Never discard completed phases.
