---
name: spec
description: "Use when planning a non-trivial Rust feature or cross-crate change to compare approaches and write a spec."
---

# /spec — write an approved spec (intent → explore → propose → spec)

The front of the spec-driven flow: **`/spec` → `/spec-tasks` → `/dev-task` (per task) →
`/spec-verify`**. You orchestrate; **delegate writes to workers when available** and prompt the
user at each gate. Protocol: `references/delegation.md`.

**Maintainer bar applies.** The spec is shaped to the maintainer-grade standard
(`references/maintainer-grade-development.md`): survey sibling crates before
inventing, encode invariants structurally, and carry a forward view. The Pre-code Maintainer
Gate (Phase 2.5) runs ON TOP OF the approach gate.

## When NOT this skill
- The idea isn't shaped yet — you don't know whether to build it at all, or the direction is
  wide open → `/brainstorm` first: it weighs 2–4 directions and writes no spec. `/spec`
  Phase 0 records a problem the user already has; it does not litigate whether that problem
  is worth solving, and it does not explore from scratch.
- The change is small enough that a spec is overhead → `/dev-task` directly.

## Phase 0 — Intent (before any technical framing)
1. **Capture the problem in the user's words, while you still have no solution to defend.**
   Quote what they asked verbatim — don't translate it into project vocabulary yet. Then ask
   the analyst questions (scope, who feels it, constraints they own, what "fixed" looks like)
   with `/grill-me` discipline: one focused question at a time, each with a recommended
   default, and **only for what genuinely lives in the user**. Anything the repo answers —
   MSRV, runtime, lint policy, who depends on this crate — you read, you don't ask. If
   `/brainstorm` or `/grill-me` already ran, seed the draft from their **pre-solution** record
   — brainstorm's step-3 goal-and-constraints header, or grill-me's synthesis — and confirm it
   rather than re-interviewing; a second interview is how a gate teaches the user to skip it.
   **Not the concept note**: brainstorm writes that at step 9, after the direction is picked, so
   it is already shaped by the chosen approach. Seeding the intent from it imports exactly the
   contamination this phase exists to prevent.
2. Slugify the feature and draft `.rust-studio/specs/<slug>/intent.md` from
   `references/templates/intent.md`. **Gate — correction, not approval:** present it and ask
   the user to fix what you got wrong. With one person owning both problem and solution,
   asking them to *approve* their own intent is theatre; asking "is this your problem?" is
   not — it is the one question only they can answer, and it is asked before an approach
   exists to bend the answer toward. Then **freeze it**: Phases 1–4 read `intent.md` and do
   not rewrite it. If drafting the spec makes you want to change the intent, stop and change
   it explicitly, logging it under `## Corrections` — that edit is the finding. A spec that
   quietly grows to match its own solution reports nothing.

## Phase 1 — Explore
3. Restate the goal in one line **from `intent.md`**, not from your reading of the code.
4. `/recall <area>` to surface prior learnings; spawn `rust-scout` to map the affected code,
   existing types, and tests. Scout uses serena MCP for symbol/reference navigation and `rg`
   for macro-generated or `cfg`-gated sites — never Bash `grep`/`find`. Note constraints
   (MSRV, no_std, async runtime, public surface).
5. **Sibling-crate reuse survey (mandatory, BEFORE proposing any new type/trait/helper).** Have
   the scout enumerate via **serena** (`find_symbol` / `find_implementations` across crates) the
   primitives, traits, error types, and helpers sibling crates already own that bear on this work.
   Every new type/trait/helper a proposed approach introduces must be justified reuse-vs-new
   against this inventory; reinventing a sibling primitive fails the Maintainer Rejection Test.

## Phase 2 — Propose
6. Spawn the owning lead (or `chief-architect` for cross-crate/architectural work) to draft
   **2–4 approaches** with trade-offs (effort, risk, semver cost, perf, testability). Each
   approach must ALSO state:
   - **(a) Invariants & encoding** — the invariants it upholds and HOW they are structurally
     encoded (newtype / enum / typestate / sealed trait / RAII), not enforced by caller discipline.
   - **(b) Failure modes / abuse cases** — how it fails and is misused; **mandatory** when the
     boundary touches untrusted input or a cross-crate trust edge.
   - **(c) Forward view** — the 2-year / 3-extension picture: after three likely extensions, does
     responsibility still sit in the right crate? Not just a one-line trade-off.
   **Freshness (cite-or-declare-version):** when an approach depends on ecosystem behavior (a
   crate's API shape, adoption pattern, RUSTSEC posture), cite the docs.rs / release-notes / source
   you checked (exa, or a crate-docs MCP if configured) OR state the last-verified version. Silence
   is a gap. **Spawn `harsh-critic` by DEFAULT** for any new-crate, cross-crate, or boundary-moving
   approach (not just hard-to-reverse ones): it attacks the recommended option (premise, failure
   modes, radically different decomposition) before the gate — no echo-chamber; fold real findings in.

## Phase 2.5 — Pre-code Maintainer Gate
7. Before the approach gate, the owning lead emits a **Maintainer-grade pre-code verdict** per
   `references/maintainer-grade-development.md` — `ACCEPTABLE` / `RESHAPE NEEDED` /
   `BLOCKED`: what crate owns the concept; which sibling primitives the survey surfaced (reused vs.
   reinvented); what a strict maintainer would reject in the recommended approach; which breaking
   changes are allowed under active dev. `RESHAPE NEEDED` loops back to Phase 2 before the user is
   asked to choose; `BLOCKED` surfaces the missing evidence. Record the verdict in the spec.

## Phase 3 — Approach gate
8. **Gate:** prompt the user — pick the approach. For a hard, costly decision, record an
   ADR (`/adr`).

## Phase 4 — Spec
9. Draft `.rust-studio/specs/<slug>/spec.md` (same slug as the intent) from
   `references/templates/spec.md`: **Problem and Non-goals carried over from `intent.md`, not
   re-authored** — a problem statement written in this phase is written by the pass that just
   picked the approach, and it comes out shaped to fit it; chosen approach + alternatives (with
   each approach's invariant-encoding, abuse cases, and forward view), public-surface & semver
   impact, the recorded pre-code verdict, **acceptance criteria in observable form**
   (given/when/then or input → effect → edge case — enumerate the real scenarios: happy path
   **plus** error paths, boundaries, and concurrency, not happy-path-only — the basis for the
   **one spec-level outer acceptance test** that tasks drive toward; `/spec-verify` checks it
   green), risks, and links (intent, ADR, recalled memory). Testing model:
   `references/testing-model.md`.
   **Trace the criteria back to intent's "What fixed looks like."** A criterion that proves only
   that the chosen approach works, with nothing in the intent it answers to, is how the flow
   ships a green `/spec-verify` for the wrong problem. Any criterion that can't be traced is
   either scope the user didn't ask for or a gap in the intent — say which.
10. **Terminal gate ("here's the plan — build it?"):** present the spec draft for the user to
    approve through the host's plan surface when available, or in the conversation otherwise.
    On approval, delegate the write to a worker when available. Reserve user prompts for the
    earlier option fork (the Phase 3 approach pick).

## Output
Confirm both artifact paths — `intent.md` (the problem, frozen) and `spec.md` (the design) —
and summarize the approach + acceptance criteria. If the intent was corrected after the spec
was drafted, say so and say why; that is the flow's most useful signal, not an embarrassment.
Verdict **COMPLETE / NEEDS WORK / BLOCKED**. Next: `/spec-tasks <slug>` to break it down. Offer
to `/remember` the key decision so it survives to future sessions.
