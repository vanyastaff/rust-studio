---
name: model-domain
description: "model domain type newtype enum type-state phantom illegal-states-unrepresentable — encode a domain concept in the Rust type system with api-designer."
argument-hint: "[domain concept]"
user-invocable: true
---

# /model-domain — encode a domain concept in the type system

Turn a domain concept into a type model that makes illegal states unrepresentable.
You are the orchestrator: **you do not write code yourself — you delegate all writes to
`rust-builder`.** Run this as a **quality loop, not a permission loop**
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §1): decide tactical calls
yourself (state choice + one-line rationale, proceed); gate with `AskUserQuestion` only
at genuine strategic forks and before irreversible actions.

## Input

`$ARGUMENTS` is the domain concept to model (e.g. "email address", "order lifecycle",
"connection state"). If empty, ask: "What domain concept should we model?" and offer
examples. For concepts that span multiple crates or public APIs, suggest running
`/architecture` first.

## Phase 1 — Clarify

1. Restate the concept in one sentence. If genuinely ambiguous (multiple plausible
   interpretations), confirm with the user; otherwise proceed.
2. Spawn **`rust-scout`** to locate any existing types, traits, or modules related to
   this concept. Scout uses serena MCP (`find_symbol`, `find_referencing_symbols`,
   `get_symbols_overview`) for semantic navigation; fall back to `rg` for
   macro-generated or `cfg`-gated sites serena can't see. Never Bash `grep`/`find`.
3. `AskUserQuestion` (genuine fork — only the user knows the domain): present what
   scout found and ask the user to enumerate:
   - **States** — what distinct situations can the concept be in?
   - **Invariants** — what must always be true? What transitions are legal?
   - **Invalid combinations** — what should be impossible to construct?

   Provide concrete prompts; users don't need to know type theory.

## Phase 2 — Design options

4. Spawn **`api-designer`** with the concept description and the enumerated states and
   invariants. Instruct it to produce 2–4 type-model options, covering at least:
   - **Newtype wrappers** — opaque single-field structs for validated primitives.
   - **Enumerations** — `enum` with variants for each distinct state or case.
   - **Type-state / phantom types** — zero-cost state tags on a generic struct,
     encoding valid transitions at compile time.
   - **Builder / sealed trait pattern** — if multi-step construction is involved.

   For each option, `api-designer` must note: what becomes a compile error, what
   remains a runtime check, ergonomics trade-offs, and semver implications (per
   `API-GATE`). Flag parse-dont-validate opportunities
   (`${CLAUDE_PLUGIN_ROOT}/rules/core.md`).

5. `AskUserQuestion` (direction-changing fork — determines all downstream work):
   present the options as a numbered list with trade-offs and a recommended default.
   Ask the user to pick one (or describe a hybrid).

## Phase 3 — Type sketch

6. Spawn **`api-designer`** again to elaborate the chosen option into a concrete type
   sketch: struct/enum definitions, key `impl` blocks (constructors, conversion traits,
   state-transition methods), and doc-comment stubs. No full implementations yet —
   this is a draft for review.

   The sketch must:
   - Apply parse-dont-validate (`${CLAUDE_PLUGIN_ROOT}/rules/core.md`): validation
     at the boundary; internal code operates on already-valid types.
   - Use `#[non_exhaustive]` on public enums where future variants are plausible.
   - Note any `unsafe` the design would require and flag it immediately.
   - Reference the module location identified by `rust-scout` (or propose one).

7. `AskUserQuestion` (gate before irreversible write): show the type sketch and ask for
   approval or revision. Loop back to Phase 2 if the user wants a different approach.

## Phase 4 — Implement

8. Spawn **`rust-builder`** with the approved sketch and the following instructions:
   - Implement the types, constructors, and trait impls from the sketch.
   - Write tests asserting compile-time guarantees (`compile_fail` doc-tests or
     trybuild where a state transition must be rejected) and runtime behaviour.
   - Run `cargo nextest run` (fall back to `cargo test`), `cargo clippy --all-targets
     --all-features -- -D warnings`, and `cargo fmt`; fix all issues.
   - Add `// SAFETY:` comments to any `unsafe`; flag it in the build report.
   - Stay strictly in scope — no opportunistic refactors.
9. Builder reports a diff summary and command output. Show it to the user.

## Phase 5 — Gate & verdict

10. Spawn **`rust-reviewer`** on the diff. Also invoke **`api-design-lead`** for the
    `API-GATE` checklist (public items documented, semver impact noted,
    `#[non_exhaustive]`/sealed where needed, no accidental `pub`).
    If `unsafe` was introduced, also spawn **`unsafe-auditor`** (`SAFETY-GATE`).

11. If findings are NEEDS WORK, return them to `rust-builder` (loop Phase 4) until
    clean or the user decides to stop.

12. Summarize: what types were introduced, which illegal states are now compile errors,
    evidence (test output, clippy output), and gates passed. End with
    **COMPLETE / NEEDS WORK / BLOCKED**.

    Suggest next steps: `/dev-task` to build logic on top of the new types or to update
    downstream call-sites, `/review` for a deeper audit.

## Error recovery

If `rust-scout` finds a conflicting existing type, surface the conflict immediately and
`AskUserQuestion` — options: (a) refine the existing type, (b) replace it, (c) introduce
a wrapper, (d) stop and raise with `chief-architect`. Never silently shadow existing types.

If `api-designer` returns **BLOCKED** (e.g. ambiguous domain invariants, missing ADR for
a design constraint), name the blocker and ask the user to resolve it before continuing.
Completed phases are never discarded.
