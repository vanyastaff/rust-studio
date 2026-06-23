---
name: spec
description: "spec design write plan — turn a non-trivial feature or change into an approved spec before building: explore the code, weigh 2-4 approaches, persist a spec doc in .rust-studio/specs/. Use before large features, cross-crate changes, or anything needing a durable record."
argument-hint: "[feature / change description]"
user-invocable: true
---

# /spec — write an approved spec (explore → propose → spec)

The front of the spec-driven flow: **`/spec` → `/spec-tasks` → `/dev-task` (per task) →
`/spec-verify`**. You orchestrate; **delegate all writes to sub-agents**; `AskUserQuestion`
at each gate. Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`.

**Maintainer bar applies.** The spec is shaped to the maintainer-grade standard
(`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`): survey sibling crates before
inventing, encode invariants structurally, and carry a forward view. The Pre-code Maintainer
Gate (Phase 2.5) runs ON TOP OF the approach gate.

## Phase 1 — Explore
1. Restate the goal in one line; confirm if fuzzy.
2. `/recall <area>` to surface prior learnings; spawn `rust-scout` to map the affected code,
   existing types, and tests. Scout uses serena MCP for symbol/reference navigation and `rg`
   for macro-generated or `cfg`-gated sites — never Bash `grep`/`find`. Note constraints
   (MSRV, no_std, async runtime, public surface).
3. **Sibling-crate reuse survey (mandatory, BEFORE proposing any new type/trait/helper).** Have
   the scout enumerate via **serena** (`find_symbol` / `find_implementations` across crates) the
   primitives, traits, error types, and helpers sibling crates already own that bear on this work.
   Every new type/trait/helper a proposed approach introduces must be justified reuse-vs-new
   against this inventory; reinventing a sibling primitive fails the Maintainer Rejection Test.

## Phase 2 — Propose
4. Spawn the owning lead (or `chief-architect` for cross-crate/architectural work) to draft
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
   you checked (exa / cratesio / context7 / rust-docs) OR state the last-verified version. Silence
   is a gap. **Spawn `harsh-critic` by DEFAULT** for any new-crate, cross-crate, or boundary-moving
   approach (not just hard-to-reverse ones): it attacks the recommended option (premise, failure
   modes, radically different decomposition) before the gate — no echo-chamber; fold real findings in.

## Phase 2.5 — Pre-code Maintainer Gate
5. Before the approach gate, the owning lead emits a **Maintainer-grade pre-code verdict** per
   `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md` — `ACCEPTABLE` / `RESHAPE NEEDED` /
   `BLOCKED`: what crate owns the concept; which sibling primitives the survey surfaced (reused vs.
   reinvented); what a strict maintainer would reject in the recommended approach; which breaking
   changes are allowed under active dev. `RESHAPE NEEDED` loops back to Phase 2 before the user is
   asked to choose; `BLOCKED` surfaces the missing evidence. Record the verdict in the spec.

## Phase 3 — Approach gate
6. **Gate:** `AskUserQuestion` — pick the approach. For a hard, costly decision, record an
   ADR (`/adr`).

## Phase 4 — Spec
7. Slugify the feature. Draft `.rust-studio/specs/<slug>/spec.md` from
   `${CLAUDE_PLUGIN_ROOT}/docs/templates/spec.md`: problem, goals/non-goals, chosen approach +
   alternatives (with each approach's invariant-encoding, abuse cases, and forward view),
   public-surface & semver impact, the recorded pre-code verdict, **acceptance criteria in
   observable form** (given/when/then or input → effect → edge case — the basis for the **one
   spec-level outer acceptance test** that tasks drive toward; `/spec-verify` checks it green),
   risks, and links (ADR, recalled memory). Testing model:
   `${CLAUDE_PLUGIN_ROOT}/docs/testing-model.md`.
8. **Terminal gate ("here's the plan — build it?"):** present the spec draft for the user to
   approve using native plan mode (on approval the user transitions into an edit mode and the
   write proceeds — delegate the write to a sub-agent). Keep `AskUserQuestion` for the earlier
   option fork (the Phase 3 approach pick), not for this final go-ahead.

## Output
Confirm the spec path and summarize the approach + acceptance criteria. Verdict
**COMPLETE / NEEDS WORK / BLOCKED**. Next: `/spec-tasks <slug>` to break it down. Offer to
`/remember` the key decision so it survives to future sessions.
