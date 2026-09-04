---
name: model-domain
description: "Use when modeling one Rust domain concept with newtypes, enums, or typestate to prevent illegal states."
---

# /model-domain — encode a domain concept in the type system

Turn a domain concept into a type model that makes illegal states unrepresentable.
You are the orchestrator: **you do not write code yourself — you delegate all writes to
`rust-builder`.** Run this as a **quality loop, not a permission loop**
(`references/collaboration.md` §1): decide tactical calls
yourself (state choice + one-line rationale, proceed); gate with a user prompt only
at genuine strategic forks and before irreversible actions.

## Input

`input` is the domain concept to model (e.g. "email address", "order lifecycle",
"connection state"). If empty, ask: "What domain concept should we model?" and offer
examples. For concepts that span multiple crates or public APIs, suggest running
`/architecture` first.

If `input` instead names an **existing** type/module whose fit has changed — "add a variant to
X", "this state doesn't cover Y anymore", "X needs a Z field for the new case" — this is
re-modelling, not greenfield: skip to **Re-modelling mode** below before Phase 1.

## Phase 1 — Clarify

1. Restate the concept in one sentence. If genuinely ambiguous (multiple plausible
   interpretations), confirm with the user; otherwise proceed.
2. Spawn **`rust-scout`** to locate any existing types, traits, or modules related to
   this concept. Scout uses serena MCP (`find_symbol`, `find_referencing_symbols`,
   `get_symbols_overview`) for semantic navigation; fall back to `rg` for
   macro-generated or `cfg`-gated sites serena can't see. Never Bash `grep`/`find`.
3. Prompt the user (genuine fork — only the user knows the domain): present what
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
     encoding valid transitions at compile time. Partial `impl` blocks expose each
     method only on the states where it is valid (an operation on the wrong state
     becomes a compile error). When the state parameter appears in no field, add a
     `PhantomData` field to record the intended variance and drop-check ownership:
     `PhantomData<S>` owns `S` (covariant, drop-check sees it), `PhantomData<fn(S) -> S>`
     forces invariance, `PhantomData<*const S>` opts out of `Send`/`Sync`. Note the
     monomorphization cost (binary growth) and factor shared logic into non-generic
     helpers.
   - **Sealed traits** — gate which types may implement a public trait via a private
     supertrait only this crate can satisfy (`mod private { pub trait Sealed {} }`;
     `pub trait Kind: private::Sealed`). Lets you add methods to the trait without a
     breaking change and rely on an exhaustive, crate-controlled set of impls. Use for
     state-tag traits and extension traits; document it, since it blocks downstream
     extension.
   - **Closed-set evolution** — choose how the set stays closed: `#[non_exhaustive]`
     on a public enum/struct for cross-crate evolution (outside code must use a `_`
     arm and cannot record-construct), versus a private marker field (`_priv: ()`) for
     within-crate discipline. Public structs that may grow: `#[non_exhaustive]` or a builder.
   - **Builder pattern** — if multi-step construction is involved; combine with
     type-state so each setter transitions to a new type and `build()` is reachable only
     once every required field is set.

   For each option, `api-designer` must note: what becomes a compile error, what
   remains a runtime check, ergonomics trade-offs, and semver implications (per
   `API-GATE`). Flag parse-dont-validate opportunities
   (`references/core.md`).

5. Prompt the user (direction-changing fork — determines all downstream work):
   present the options as a numbered list with trade-offs and a recommended default.
   Ask the user to pick one (or describe a hybrid).

## Phase 3 — Type sketch

6. Spawn **`api-designer`** again to elaborate the chosen option into a concrete type
   sketch: struct/enum definitions, key `impl` blocks (constructors, conversion traits,
   state-transition methods), and doc-comment stubs. No full implementations yet —
   this is a draft for review.

   The sketch must:
   - Apply parse-dont-validate (`references/core.md`): validation
     at the boundary; internal code operates on already-valid types.
   - Use `#[non_exhaustive]` on public enums where future variants are plausible.
   - Note any `unsafe` the design would require and flag it immediately.
   - Reference the module location identified by `rust-scout` (or propose one).

7. Terminal "here's the plan — build it?" gate: present the type sketch for the user to
   approve through the host's plan surface when available, or in the conversation otherwise.
   Reserve user prompts for the earlier option fork (the Phase 2 direction choice). Loop back to
   Phase 2 if the user wants a
   different approach.

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

## Re-modelling mode — extend or re-cut?

An alternate entry point for the case Phase 1–5 doesn't cover: not a fresh concept but an
existing model a requirement has outgrown. The output is a decision — **EXTEND** / **RE-CUT** /
**RE-CUT, ESCALATED** — not a lecture; EXTEND is a correct answer whenever the current shape
genuinely still covers the concept, and this mode must be able to reach it.

R1. Spawn **`rust-scout`** scoped to the existing type, not just its location: every
    field/variant, every call site, every `impl`, and — from tests and doc comments, not
    guesswork — the requirements the shape was cut to serve versus the ones it serves today.

R2. Check the shape against the **Design-drift tells** (`references/types.md`
    §"Design-drift tells"). Name which fire, and where (`path:line`). A tell that doesn't fire is
    evidence for EXTEND, not silence — record that too.

R3. Answer the decision basis from what R1/R2 found:
    - **Requirement count** — how many requirements the shape serves today (distinct call sites
      / match arms / callers) versus how many it was originally cut for. Serving meaningfully
      more, through drift-tell shapes (a bolted-on bool, an always-`None` field), is outgrowing
      the cut; serving about the same, or more through the type's *existing* dimensions, is not.
    - **Variant or different concept** — does the new requirement branch on a dimension the type
      already models (a legitimate new case of the same concept), or does it need a field/method
      that is meaningless for the type's existing cases (a different concept wearing this type)?
      The latter is never EXTEND, regardless of how small the diff looks.
    - **Blast radius vs. carry cost** — the re-cut's blast radius (the call sites R1 found; the
      Controlled-growth guidance in `references/types.md` if `#[non_exhaustive]` is at stake)
      against the compounding cost of one more special case on a shape that already failed R2. A
      wide blast radius does not by itself justify EXTEND once R2 has fired.

R4. Decide, and carry the verdict into the phase named below — do not invent a separate verdict
    vocabulary:
    - **EXTEND** — no drift tell fires, or the new requirement is a clean variant the shape
      absorbs without a new bool/Option/wildcard. State which tells were checked and why none
      apply, then proceed to Phase 3 (type sketch) to add the variant/field within the current
      shape.
    - **RE-CUT** — one or more tells fire, the requirement is a different concept in the old
      type's clothes, and the blast radius sits inside this task's boundary. State the firing
      tells and the target shape, then proceed to Phase 2 (design options) scoped to that shape.
    - **RE-CUT, ESCALATED** — the re-cut is correct but its blast radius reaches beyond this
      task (other crates, other teams' call sites, a module boundary). Implement the immediate
      ask as EXTEND — the smallest change that does not deepen the drift — or decline to
      implement if even that isn't safe, and raise a **non-blocking escalation** to
      `product-steward` (scope/story) or `chief-architect` (module boundary): the same route
      `/review`'s Accretion check uses. Name the escalation and what shipped instead in the
      Phase 5 verdict; never let the wider reshape block the task in front of you.

## Error recovery

If `rust-scout` finds a conflicting existing type, surface the conflict immediately and
Prompt the user — options: (a) refine the existing type, (b) replace it, (c) introduce
a wrapper, (d) stop and raise with `chief-architect`. Never silently shadow existing types.

If `api-designer` returns **BLOCKED** (e.g. ambiguous domain invariants, missing ADR for
a design constraint), name the blocker and ask the user to resolve it before continuing.
Completed phases are never discarded.
