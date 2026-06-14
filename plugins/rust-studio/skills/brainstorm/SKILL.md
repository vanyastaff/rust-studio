---
name: brainstorm
description: "Brainstorm / explore / ideate a crate or feature idea before any design — clarify intent, surface constraints, lay out 2–4 approaches with trade-offs. Pure thinking, no code."
argument-hint: "[idea or problem]"
user-invocable: true
---

# /brainstorm — explore an idea before committing to a design

Think through a Rust idea end-to-end: clarify what is really being asked, surface
constraints and unknowns, and lay out 2–4 concrete approaches with trade-offs. No APIs,
no code, no files written. You are the facilitator per the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`): **Question → Options → Decision →
Draft → Approval.** Delegate concept-note capture to `product-steward`; never write files
yourself.

## Input

`$ARGUMENTS` is the raw idea or problem. If empty, ask: "What are you thinking about
building or changing?" If very broad, probe domain (new crate, feature in existing crate,
cross-crate concern) before proceeding.

## Phase 1 — Clarify intent

1. Restate the idea in one sentence. Flag immediately if it is under-specified.
2. `AskUserQuestion` with targeted questions — no more than three at once — to surface:
   - **Goal**: what problem does this solve for users of the crate/binary?
   - **Scope**: new crate, new module, extension to an existing API, or cross-workspace?
   - **Constraints**: MSRV floor, `no_std` requirement, async vs. sync, compile-time vs.
     runtime, public-API stability expectations.
   - **Non-goals**: what should this explicitly *not* do?
3. Record the clarified goal and constraints as a short header before the options; revise
   them if the conversation shifts.

## Phase 2 — Surface unknowns

4. List open questions that would affect any approach (dependency risks, ecosystem
   alternatives, performance envelope, safety invariants, test complexity). Label each:
   - **[BLOCKER]** — must be resolved before design can start.
   - **[RISK]** — worth tracking; can proceed with a stated assumption.
   - **[NICE-TO-KNOW]** — informational; does not block.

   For ecosystem-alternative unknowns, pull data before presenting — use the **exa** MCP
   (`web_search_exa` for crates.io adoption / RUSTSEC, `get_code_context_exa` for real
   usage examples). Evidence over opinion (`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`).

5. If a `[BLOCKER]` is present, surface it immediately and `AskUserQuestion` with options
   before continuing.

## Phase 3 — Present approaches

6. Propose **2–4 concrete approaches** (not straw-men). For each:
   - **Name** — short label so the user can refer back to it.
   - **Summary** — one sentence on what it does differently from the others.
   - **Pros** — what it does well in the Rust context (ergonomics, performance, safety,
     compile-time cost, ecosystem fit).
   - **Cons** — real trade-offs, not invented ones.
   - **Key unknowns** — what you still need to know to fully evaluate it.
   - **Rough gate exposure** — which quality gates (`ARCH-GATE`, `API-GATE`, `SAFETY-GATE`,
     etc.) would this approach likely need? Reference
     `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md §4`.
7. State a **default recommendation** and the reason; make clear it is a starting point,
   not a decision.
8. `AskUserQuestion`: "Which direction do you want to explore, or should we mix elements?"

## Phase 4 — Concept note

9. Once the user picks a direction, produce a short **concept note** (no headings, plain
   prose, ≤ 200 words) covering:
   - Chosen approach and why.
   - Constraints it must respect.
   - Open risks and assumptions.
   - Suggested next skill to invoke.
10. `AskUserQuestion`: "Does this capture the idea correctly, or should anything change?"
11. On approval, **delegate saving the concept note** to `product-steward` — do not write
    files directly. Instruct `product-steward` to store it at the path it deems appropriate
    per the template `${CLAUDE_PLUGIN_ROOT}/docs/templates/concept-note.md` (if that
    template exists; otherwise plain text is fine).

## Handoff

After the concept note is approved, suggest the natural next step and offer to invoke it
(confirm before starting):

- **API shape needed** → `/design-api` (public-surface design with `api-design-lead`).
- **Cross-crate or architectural scope** → `/architecture` (ADR + crate-boundary mapping
  with `chief-architect`).
- **Ready to break into stories** → hand to `product-steward` for a story breakdown.
- **Prototype spike only** → `/dev-task` in **solo** review mode.

## Constraints

- No code snippets, no type signatures, no module trees, no file paths to edit. Those
  belong in `/design-api`, `/architecture`, or the implementation phase.
- No files written by this skill. All writes go through `product-steward` or the
  appropriate downstream skill after user approval.
- If the user pushes for implementation details, acknowledge the instinct and redirect:
  "Let's lock down the approach first — implementation details will be cleaner once we
  know the direction."
- If `$ARGUMENTS` describes something already well-understood (a trivial bug fix, a
  one-line change), say so and suggest `/dev-task` directly rather than over-process.
