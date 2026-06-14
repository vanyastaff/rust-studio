---
name: test-plan
description: "Produce a test plan for a feature with qa-lead/test-engineer — test types, cases, edge cases, and property laws."
argument-hint: "[feature]"
user-invocable: true
---

# /test-plan — produce a test plan for a feature

Run a feature through **scope → map criteria → choose types → enumerate cases → draft → approve → hand off**, honoring the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You are the orchestrator: **you do not write files directly — you delegate writes to specialists.** Gate with `AskUserQuestion` only at phase boundaries (plan approval, BLOCKED recovery) — decide tactical calls yourself, state choice + one-line rationale.

## Input

`$ARGUMENTS` is the feature. If it is a path, read that file. If empty, ask: "What feature should we plan tests for?" and suggest running `/architecture` or `/dev-task` first if the feature is not yet defined.

## Phase 1 — Scope

1. Restate the feature and its acceptance criteria in 1–5 bullets. If criteria are missing, draft a plausible list from context and proceed — surface the draft in the Phase 4 output rather than stopping to ask.
2. Spawn **`rust-scout`** (read-only) to locate existing tests, the module under test, and any related fixtures or helpers. Scout uses serena MCP (`find_symbol`, `find_referencing_symbols`, `search_for_pattern`) for symbol/reference navigation and `rg` for macro-generated or `cfg`-gated sites serena can't see — never Bash `grep`/`find`.
3. Identify the owning lead from the domain (see `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md`). If the feature spans domains, note each one.

## Phase 2 — Map criteria to tests

4. Spawn **`qa-lead`** and **`test-engineer`** in parallel to:
   - Map each acceptance criterion to one or more concrete test cases.
   - Choose the appropriate type mix. Decide this tactically — state the chosen mix and rationale, don't present it as a question unless a genuine trade-off requires user input (e.g. proptest vs no proptest on a deadline):

     | Type | When to use |
     |------|-------------|
     | **unit** | Pure logic, isolated functions, type-level invariants |
     | **integration** | Multi-component interactions, real I/O, database, HTTP |
     | **doc** (`rustdoc`) | Public API examples that must compile and run |
     | **property** (`proptest`/`quickcheck`) | Laws that must hold for all valid inputs |
     | **bench** (`criterion`/`divan`) | Hot paths where perf regression matters |

5. For each proposed test, note: the function/module under test, the input class, the expected behavior, and how it maps to an acceptance criterion.

## Phase 3 — Edge cases and property laws

6. `qa-lead` enumerates edge cases for the feature's inputs. Cover at minimum:
   - **Empty / zero** — empty strings, empty collections, zero counts, default structs.
   - **Maximum / overflow** — `u64::MAX`, `usize::MAX`, max-length strings, full buffers.
   - **Boundary** — off-by-one indices, first/last elements, closed vs. open ranges.
   - **Unicode / encoding** — multi-byte chars, RTL text, NUL bytes, non-UTF-8 bytes where accepted.
   - **Concurrent** — data races, ordering guarantees, cancellation, `Send`/`Sync` bounds.

7. `test-engineer` proposes **property laws** where applicable. Common laws to evaluate:
   - **Round-trip** — `decode(encode(x)) == x`; `parse(display(x)) == x`.
   - **Idempotence** — `f(f(x)) == f(x)` for normalization, deduplication, sorting.
   - **Identity / zero element** — combining with the identity element is a no-op.
   - **Commutativity / associativity** — order of inputs does not change the result.
   - **Monotonicity** — if `a ≤ b` then `f(a) ≤ f(b)`.
   - **Invariant preservation** — structural constraints hold after every mutation.

   For each law, state the property in plain English, then propose the `proptest!` / `quickcheck!` strategy.

## Phase 4 — Draft plan

8. Spawn **`test-engineer`** to fill the template at `${CLAUDE_PLUGIN_ROOT}/docs/templates/test-plan.md` with:
   - Feature name and acceptance criteria (from Phase 1; flag any that were inferred).
   - Ordered table: test ID, type, criterion covered, description, inputs, expected outcome.
   - Edge-case matrix and property-law statements.
   - Suggested file locations, module names, and helper fixtures.
   - Applicable gate: `QA-GATE` (owner: `qa-lead`); note any other gates triggered (e.g. `PERF-GATE` for benches, `SAFETY-GATE` for `unsafe`-touching paths).
   - Relevant rules: `${CLAUDE_PLUGIN_ROOT}/rules/testing.md`; add others (e.g. `${CLAUDE_PLUGIN_ROOT}/rules/perf.md`, `${CLAUDE_PLUGIN_ROOT}/rules/unsafe.md`) as needed.

   `test-engineer` shows the draft. **No file is written until approval.**

## Phase 5 — Approve (gate)

9. Terminal "here's the plan — build it?" gate: present the draft plan — criterion count, test count by type, edge-case categories, property laws — for the user to approve using native plan mode (on approval the user transitions into an edit mode and the file is written). Reserve `AskUserQuestion` for genuine option forks (e.g. a real proptest-vs-no-proptest trade-off in Phase 2), not for this final approval. If the user wants edits, loop back to Phase 2 or 3 and re-draft.
10. On approval, `test-engineer` writes the plan to a feature-specific path (e.g. `docs/test-plans/<feature>.md`), or to a path the user names.

## Phase 6 — Hand off

11. Summarize what the plan covers: criterion count, test count by type, edge-case categories, property laws.
12. Offer next steps:
    - `/test-setup` — scaffold the test harness and fixture code from this plan.
    - `/dev-task` — implement the feature under the test plan's coverage.
    - `/review` — audit an existing diff against these criteria.
    - `/perf` — if bench tests were included, run baseline measurements now.

## Error recovery

If `rust-scout` finds no related tests and the module does not exist yet, note it and proceed with the plan against the feature spec alone. Flag the gap in the plan.

If `qa-lead` or `test-engineer` returns **BLOCKED** (e.g. acceptance criteria missing, ambiguous behavior, upstream design unresolved), surface the blocker immediately and `AskUserQuestion` with options: (a) supply the missing criteria now, (b) narrow scope to what is defined, (c) stop and run `/architecture` or `/adr` first. Never discard work completed before the block.
