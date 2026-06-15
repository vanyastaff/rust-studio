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

**Maintainer bar applies.** The surface is held to the maintainer-grade standard
(`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`): survey sibling crates before
inventing a new type/trait/error, encode invariants structurally (newtype / enum / typestate /
sealed / `#[non_exhaustive]`) over caller discipline, and carry a forward view. The Pre-code
Maintainer Gate (Phase 2.5) runs ON TOP OF `API-GATE`.

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

5. **Sibling-crate reuse survey (mandatory, BEFORE drafting any new type/trait/error).** Have
   `rust-scout` (or `api-designer`) enumerate via **serena** (`find_symbol` /
   `find_implementations` across crates) the types, traits, error types, and conversions sibling
   crates already own that this surface could reuse. Every new item the design introduces must be
   justified reuse-vs-new against this inventory; reinventing a sibling primitive (or duplicating
   an error taxonomy) fails the Maintainer Rejection Test.
6. Spawn **`api-designer`** to draft 2–4 distinct API shapes covering the
   ergonomics-vs-flexibility-vs-semver spectrum. For each option include:
   - The type/trait/fn signatures (condensed; full signatures in the doc).
   - Ergonomics: how easy is the common call-site?
   - Flexibility: can callers extend or adapt it?
   - Semver risk: BREAKING / MINOR / PATCH relative to the current surface? Flag the
     silent majors explicitly — adding a blanket impl on a fundamental type (`&T`, `&mut T`,
     `Box<T>`, `Pin<P>`) is a MAJOR break even though it looks additive, as is removing a
     `#[non_exhaustive]` or a public marker field.
   - **(a) Invariants & encoding** — the invariants the shape upholds and HOW they are
     structurally encoded (newtype / enum / typestate / sealed trait / smart constructor / RAII /
     `#[non_exhaustive]`), so correctness is done-by-construction, not by caller discipline.
   - **(b) Failure modes / abuse cases** — how the surface is misused or fails; **mandatory** when
     the API consumes untrusted input or sits on a cross-crate trust boundary (parse-don't-validate;
     can a caller construct an invalid state?).
   - **(c) Forward view** — the 2-year / 3-extension picture: after three likely extensions, does
     the type still belong in this crate, and does the shape extend without a breaking churn?
   - Key trade-off in one sentence.
   **Freshness (cite-or-declare-version, REQUIRED when the shape depends on ecosystem behavior):**
   cite the crates.io adoption pattern / RUSTSEC advisory / docs.rs API shape you checked via
   **exa MCP** (`get_code_context_exa` / `web_search_exa`) and **cratesio** / **context7** /
   **rust-docs**, OR state the last-verified version. Silence is a gap, not a pass.
   **Spawn `harsh-critic` by DEFAULT** for any new-trait, cross-crate, or boundary-moving surface:
   it attacks the recommended shape (premise, failure modes, radically different decomposition);
   fold real findings into the options before the gate.
7. Spawn **`error-architect`** in parallel to draft the error type for each option
   (or a single shared error design if the options converge there). Include:
   - The error enum variants or wrapper type — a `thiserror` typed enum, never a bare
     `Box<dyn Error>` or a stringly error where a domain variant belongs.
   - `Display` / `Error` / `From` impl notes (`#[from]` for the conversions worth one).
   - **Return the consumed argument on error.** When a fallible call takes ownership of a
     value the caller might want to retry, hand it back in the error (`Err(SendError(value))`,
     mirroring `String::from_utf8` → `into_bytes`) so the caller retries without cloning.
     Drop this only when the argument is cheap or genuinely unrecoverable.
   - Stability marker: `#[non_exhaustive]` for cross-crate error enums that may grow a variant;
     a private marker field (`_priv: ()`) for within-crate-only discipline. Recommend one
     explicitly — never leave a public error enum exhaustive-by-default if new variants are likely.
8. Merge both agents' output and present it clearly. Offer a recommended default and
   explain why — the user makes the final call in Phase 3.

## Phase 2.5 — Pre-code Maintainer Gate

9. Before the decision gate, `api-design-lead` (or `api-designer`) emits a **Maintainer-grade
   pre-code verdict** per `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md` —
   `ACCEPTABLE` / `RESHAPE NEEDED` / `BLOCKED`: what crate owns the type/error; which sibling
   primitives the survey surfaced (reused vs. reinvented); whether the shape encodes invariants
   structurally or leans on caller discipline (stringly/bool/`Box<dyn Error>` where a domain type
   belongs is a reject); which breaking changes active dev permits. `RESHAPE NEEDED` reworks the
   shape before the user is asked; `BLOCKED` surfaces the missing prerequisite. Record the verdict
   in the design doc.

## Phase 3 — Decision (gate)

10. `AskUserQuestion`: present the options with their trade-offs and ask the user to
    choose one (or a hybrid). Do not proceed past this gate without an explicit choice.

## Phase 4 — Draft (API design doc)

11. Spawn **`api-designer`** (and **`error-architect`** for any remaining error-type
    details) to produce a full draft of the chosen surface. The draft must cover:
   - All public types, traits, and function signatures with doc-comment stubs.
   - `#[must_use]` on every return whose value the caller must not silently drop — `Result`,
     RAII guards, builders that return `Self`, and any "you forgot to act on this" value;
     give it a reason string (`#[must_use = "…"]`) where the consequence isn't obvious.
   - The error type with all variants and `From` conversions.
   - Stability markers spelled out: `#[non_exhaustive]` on public enums/structs that may grow
     (cross-crate) vs a private marker field (`_priv: ()`) for within-crate discipline; a
     sealed trait where downstream impls must be forbidden. State the choice, don't default silently.
   - Semver impact statement: **BREAKING** / **MINOR** / **PATCH**, and which items
     trigger it (`${CLAUDE_PLUGIN_ROOT}/rules/api.md` for the semver ruleset). Call out
     deceptively-additive majors — a blanket impl on a fundamental type (`&T`, `&mut T`,
     `Box<T>`, `Pin<P>`) is a MAJOR break.
   - Usage example (doc-test skeleton showing the primary call site).
   - Any items gated behind `#[cfg(feature = "...")]` and why.
   - Open questions or follow-up ADR items, if any.
12. Delegate writing the draft to **`rust-builder`** using the template at
    `${CLAUDE_PLUGIN_ROOT}/docs/templates/api-design-doc.md`.

## Phase 5 — Approval (gate)

13. Present the complete draft and the semver impact statement as the terminal "here's the
    plan — build it?" gate for the user to approve using native plan mode (on approval the
    user transitions into an edit mode and implementation begins). Keep `AskUserQuestion`
    for the earlier option fork (the Phase 3 decision gate), not for this final sign-off. If
    the user requests changes, loop back to Phase 4 (or Phase 2 if the shape itself needs to change).
14. Once approved, confirm the **API-GATE** checklist from
    `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` is satisfied:
    - Public items have doc-comment stubs.
    - Semver impact is understood and recorded — including deceptively-additive majors
      (a blanket impl on a fundamental type `&T` / `&mut T` / `Box<T>` / `Pin<P>`).
    - `#[non_exhaustive]` (cross-crate) vs private-marker-field (within-crate) / sealed-trait
      decisions are explicit, not defaulted.
    - `#[must_use]` is on every return the caller must not silently discard.
    - No accidental `pub` items.

## Phase 6 — Handoffs

15. Delegate implementation to **`rust-builder`** via `/dev-task`, passing the
    approved API design doc as the task input. The builder works test-driven against
    the agreed signatures; no improvised surface changes during build.
16. Once implementation is complete, hand the diff to `/api-review` for a focused
    API-GATE audit before the change is considered mergeable.
17. If the design reveals a meaningful architecture decision (crate boundary, new
    abstraction, MSRV implication), surface it as an ADR candidate via `/adr`.

## Error recovery

If **`api-designer`** or **`error-architect`** returns **BLOCKED** (missing context,
conflicting existing types, unresolved ADR), surface the blocker immediately and
`AskUserQuestion` with options:
- (a) Resolve the blocker first (suggest `/adr` or `/architecture`).
- (b) Narrow the scope and design a subset of the surface.
- (c) Proceed with explicit assumptions noted in the design doc.

Never discard a partial draft — preserve it and note the open questions.
