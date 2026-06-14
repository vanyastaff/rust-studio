---
name: design-api
description: "Design / api design — single public API surface (lighter than /team-api): types, traits, signatures, error type, semver impact, via api-designer and error-architect."
argument-hint: "[type/feature]"
user-invocable: true
---

# /design-api — design a focused public API surface

Design a single public API surface end-to-end — types, traits, function signatures,
the error type, and semver impact — through a structured **Question → Options →
Decision → Draft → Approval** loop before any code is written. You are the
orchestrator: **you do not write code or files yourself — you delegate writes to
`rust-builder` and specialists.**

## Input

`$ARGUMENTS` is the type or feature to design. If empty, ask: "What API surface are
we designing?" and suggest running `/architecture` or `/brainstorm` first for
non-trivial or cross-crate work (those warrant `/team-api`). If the feature involves
multiple crates or a major breaking change, recommend `/team-api` instead.

## Phase 1 — Question (clarify scope)

1. Restate what is being designed in one sentence. If genuinely ambiguous (not just
   underspecified), batch all scope questions into one `AskUserQuestion`.
2. Identify the consumer: internal crate, external downstream, or public crates.io
   surface — this drives semver and stability strictness. Resolve from context if
   obvious; otherwise include in the batched ask.
3. Spawn **`rust-scout`** (uses serena MCP + `rg` under the hood) to locate the
   current module, any existing types or traits it builds on, and the test files.
   Do not guess the layout.
4. Decide tactical defaults autonomously (state choice + one-line rationale):
   - Sync vs async; owned vs borrowed; `Send + Sync` requirement — infer from
     codebase patterns.
   - Error handling: `thiserror` enum is the default for public surfaces; note if
     deviating.
   - Stability promise: `#[non_exhaustive]` on enums/structs by default for public
     crates.io APIs.
   If any of these would change the shape materially and can't be resolved from
   context, include them in the batched ask above.

## Phase 2 — Options (present alternatives)

5. Spawn **`api-designer`** to draft 2–4 distinct API shapes covering the
   ergonomics-vs-flexibility-vs-semver spectrum. For each option include:
   - The type/trait/fn signatures (condensed; full signatures in the doc).
   - Ergonomics: how easy is the common call-site?
   - Flexibility: can callers extend or adapt it?
   - Semver risk: BREAKING / MINOR / PATCH relative to the current surface?
   - Key trade-off in one sentence.
   Use **exa MCP** (`get_code_context_exa` / `web_search_exa`) to check real
   crates.io adoption patterns and RUSTSEC advisories that bear on the shape choices.
6. Spawn **`error-architect`** in parallel to draft the error type for each option
   (or a single shared error design if the options converge there). Include:
   - The error enum variants or wrapper type.
   - `Display` / `Error` / `From` impl notes.
   - Whether `#[non_exhaustive]` is recommended.
7. Merge both agents' output and present it clearly. Offer a recommended default and
   explain why — the user makes the final call in Phase 3.

## Phase 3 — Decision (gate)

8. `AskUserQuestion`: present the options with their trade-offs and ask the user to
   choose one (or a hybrid). Do not proceed past this gate without an explicit choice.

## Phase 4 — Draft (API design doc)

9. Spawn **`api-designer`** (and **`error-architect`** for any remaining error-type
   details) to produce a full draft of the chosen surface. The draft must cover:
   - All public types, traits, and function signatures with doc-comment stubs.
   - The error type with all variants and `From` conversions.
   - Semver impact statement: **BREAKING** / **MINOR** / **PATCH**, and which items
     trigger it (`${CLAUDE_PLUGIN_ROOT}/rules/api.md` for the semver ruleset).
   - Usage example (doc-test skeleton showing the primary call site).
   - Any items gated behind `#[cfg(feature = "...")]` and why.
   - Open questions or follow-up ADR items, if any.
10. Delegate writing the draft to **`rust-builder`** using the template at
    `${CLAUDE_PLUGIN_ROOT}/docs/templates/api-design-doc.md`.

## Phase 5 — Approval (gate)

11. `AskUserQuestion`: show the complete draft and the semver impact statement.
    Get explicit sign-off before any implementation work begins. If the user requests
    changes, loop back to Phase 4 (or Phase 2 if the shape itself needs to change).
12. Once approved, confirm the **API-GATE** checklist from
    `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` is satisfied:
    - Public items have doc-comment stubs.
    - Semver impact is understood and recorded.
    - `#[non_exhaustive]` / sealed-trait decisions are explicit.
    - No accidental `pub` items.

## Phase 6 — Handoffs

13. Delegate implementation to **`rust-builder`** via `/dev-task`, passing the
    approved API design doc as the task input. The builder works test-driven against
    the agreed signatures; no improvised surface changes during build.
14. Once implementation is complete, hand the diff to `/api-review` for a focused
    API-GATE audit before the change is considered mergeable.
15. If the design reveals a meaningful architecture decision (crate boundary, new
    abstraction, MSRV implication), surface it as an ADR candidate via `/adr`.

## Error recovery

If **`api-designer`** or **`error-architect`** returns **BLOCKED** (missing context,
conflicting existing types, unresolved ADR), surface the blocker immediately and
`AskUserQuestion` with options:
- (a) Resolve the blocker first (suggest `/adr` or `/architecture`).
- (b) Narrow the scope and design a subset of the surface.
- (c) Proceed with explicit assumptions noted in the design doc.

Never discard a partial draft — preserve it and note the open questions.
