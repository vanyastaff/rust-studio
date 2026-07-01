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

**Maintainer bar applies.** Every option, boundary, and gate in this session is held to the
maintainer-grade standard (`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`): reuse
over reinvent, structural invariants over caller discipline, and a forward-looking ownership view —
not just a one-line trade-off. The Pre-code Maintainer Gate (Phase 2.5) runs ON TOP OF `ARCH-GATE`.

## Input
`$ARGUMENTS` is the scope or goal. If it names a crate, module, or feature, start there. If it
names a path, read that file as the brief. If empty, ask: "What are we designing — a new crate,
a module reorganization, or a specific subsystem?" and, for greenfield work, suggest describing
the key use-cases before proceeding.

## Phase 1 — Map the current structure
**Recall first:** `/recall <scope>` (or reuse the session-start memory index if it already
surfaced this area) — prior ADRs and architecture decisions are binding context; carry them into
the mapping and options, and say when a recalled note changes the approach. If nothing surfaces,
proceed (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
1. Spawn **`rust-scout`** to produce a `file:line` map of all crate roots (`Cargo.toml`),
   `lib.rs` / `main.rs` entry points, `pub use` re-exports, and existing module boundaries in
   scope. Use **serena** (`find_symbol`, `get_symbols_overview`) for symbol
   and boundary navigation; use **`cargo modules`** to render the module tree; use **`rg`** for
   macro-generated or `cfg`-gated sites serena can't see. Do not guess the layout.
2. **Sibling-crate reuse survey (mandatory, BEFORE proposing any new type/trait/helper).** Have
   the scout enumerate via **serena** (`find_symbol` / `find_implementations` / `find_referencing_symbols`
   across crates) what primitives, traits, error types, builders, and helpers already exist in
   sibling crates that bear on this design. For every new type/trait/helper the architecture would
   introduce, you must later justify reuse-vs-new against this inventory — reinventing a sibling
   crate's primitive is a Maintainer-Rejection-Test failure.
3. Spawn **`chief-architect`** (read-only) to review the scout's map and name:
   - current layering order (e.g. `domain → infra → app`),
   - obvious layering violations or circular dependencies,
   - missing or unnamed boundaries.
4. Present the map as a concise table or list (crate/module, role, known issues). If something
   looks clearly wrong or out of scope, note it and proceed — ask only if the scope itself is
   genuinely ambiguous.

## Phase 2 — Identify real decisions
5. **`chief-architect`** identifies the design questions that actually need answering (e.g.
   split vs. merge a crate, which crate owns a type, visibility rules, async boundary placement).
   Narrow to the 2–5 decisions that drive everything else.
6. For each decision, present **2–4 options** with concrete trade-offs (coupling, compile time,
   reuse, `pub` surface, maintainability). Each option must ALSO state:
   - **(a) Invariants & encoding** — the invariants the option must uphold and HOW they are
     structurally encoded (newtype / enum / typestate / sealed trait / private field / RAII guard),
     so correctness rests on the type system, not caller discipline.
   - **(b) Failure modes / abuse cases** — how the option fails and how it is misused; **mandatory**
     when the boundary touches untrusted input or a cross-crate trust edge (enumerate the abuse
     cases, don't hand-wave).
   - **(c) Forward view** — the 2-year / 3-extension picture: after three likely extensions, does
     responsibility still sit in the right crate? Not just a one-line trade-off.
   - **Freshness (cite-or-declare-version):** when the decision depends on ecosystem behavior
     (a crate's API shape, an adoption pattern, RUSTSEC posture), cite the docs.rs / release-notes
     / source you checked via **exa** (`web_search_exa`, `web_fetch_exa`) — or a crate-docs MCP
     (cratesio/context7/rust-docs) if one is configured — OR state the last-verified version. Silence is a gap, not a pass.
   Mark the architect's recommended default. **Spawn `harsh-critic` by DEFAULT** for any new-crate,
   cross-crate, or boundary-moving plan — not opt-in "load-bearing only": it attacks the recommended
   option (challenge the premise, propose a radically different decomposition) — let the design
   survive only if it beats the alternatives, then fold real findings in.

## Phase 2.5 — Pre-code Maintainer Gate
7. Before the decide gate, `chief-architect` emits a **Maintainer-grade pre-code verdict** per
   `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md` — `ACCEPTABLE` / `RESHAPE NEEDED` /
   `BLOCKED`. It answers: what crate owns the concept; which sibling primitives the reuse survey
   surfaced (and which the design reuses vs. reinvents); what a strict maintainer would reject in the
   proposed decomposition; which breaking changes are allowed because the workspace is in active dev.
   `RESHAPE NEEDED` loops back to Phase 2 before the user is asked to choose; `BLOCKED` surfaces the
   missing decision/evidence. Only an `ACCEPTABLE` (or knowingly-accepted-tradeoff) verdict proceeds.

## Phase 3 — Decide (gate)
8. `AskUserQuestion`: show the decision list and options; get explicit choices before any draft
   is produced. Batch all open decisions into one ask. If the user defers a decision, record it
   as `OPEN` and proceed only with the settled ones.
9. If a decision requires an Architecture Decision Record, note it here — it will be written in
   Phase 5 via `/adr`.

## Phase 4 — Draft the architecture
10. **`chief-architect`** drafts a module/crate diagram and prose description covering:
    - crate/module names and their single responsibility,
    - dependency direction (arrows must be acyclic),
    - key public types and traits at each boundary,
    - what is explicitly **not** in scope (anti-corruption boundaries).
11. Present the draft. State the key choices made and their rationale. If the draft reveals a
    new direction-changing fork, escalate; otherwise proceed to Phase 5.

## Phase 5 — Record decisions and docs (gate)
12. For each decision marked for an ADR in Phase 3, spawn `/adr` with the decision context,
    options, and chosen outcome. Do not write ADRs inline — delegate to the `/adr` skill.
13. Present the finished architecture draft as the terminal "here's the plan — build it?" gate
    for the user to approve using native plan mode (on approval the user transitions into an edit
    mode). Keep `AskUserQuestion` for the earlier option forks (the Phase 3 decision gate), not
    for this final go-ahead. If approved, delegate to **`rust-builder`** to write
    `docs/architecture.md` in the project (using `${CLAUDE_PLUGIN_ROOT}/docs/templates/architecture.md`
    as the template) from the approved draft. The builder must not add content beyond what was approved in Phase 4.
14. Show the committed doc path and a diff summary.

## Phase 6 — ARCH-GATE
15. Spawn **`chief-architect`** to run `ARCH-GATE` against the final architecture doc and the
    scout's map:
    - Module/crate boundaries are sound and non-overlapping.
    - Dependency direction is acyclic and documented.
    - An ADR exists for every non-trivial design choice.
    - No layering violations remain (or they are explicitly deferred with a tracking note).
16. If `ARCH-GATE` returns **NEEDS WORK**, list the specific gaps, hand them back to
    `chief-architect` for revision (loop to Phase 4), and re-run the gate.
17. If `ARCH-GATE` returns **BLOCKED** (e.g. an open external dependency), surface the blocker,
    do not proceed, and `AskUserQuestion` with options: (a) defer and document the gap, (b) scope
    down to what is unblocked, (c) resolve the dependency first.

## Phase 7 — Hand off
18. Once `ARCH-GATE` is **COMPLETE**, spawn **`product-steward`** with:
    - the approved architecture doc path,
    - the list of settled decisions and any open items,
    - a prompt to break the design into implementable stories for `/dev-task`.
19. Summarize to the user: decisions made, ADRs written, doc location, open items (if any), and
    the first suggested `/dev-task` to kick off implementation.
    **Persist what settled:** an architecture decision is the #1 thing to persist — sweep agent
    verdicts for `MEMORY:` lines and run `/remember` for each (it dedups), and `/remember` each
    settled decision + rationale — or state "nothing durable"
    (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
20. Suggest next steps: `/dev-task` for the first story, `/review` after an initial implementation,
    `/perf` if performance boundaries were a driver.

## Error recovery
If any sub-agent returns **BLOCKED** (missing context, unresolved dependency, conflicting
constraints): surface it immediately, do not proceed past the blocked item, and `AskUserQuestion`
with options — (a) narrow scope and continue, (b) gather missing context and retry, (c) stop and
resolve the prerequisite. Never discard completed phases.
