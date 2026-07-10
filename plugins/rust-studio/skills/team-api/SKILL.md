---
name: team-api
description: "Use when designing and shipping a Rust public API with implementation, docs, tests, and semver review."
---

# /team-api — design & ship a public API

Orchestrate the API team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.** Gate at phase boundaries (quality gates,
not permission loops) — decide tactical calls yourself with a one-line rationale.
Protocol: `references/delegation.md` (§8 team execution).

## Orchestration & progress
Execute the phases through the host capabilities described in **`references/delegation.md` §8**.
Use workers and a native task surface when available; otherwise run each named role inline and
keep a concise checklist. Surface every phase result in one line before advancing.

## Team composition
`api-design-lead` (owns API-GATE) · `api-designer` · `error-architect` · `docs-engineer`
· `test-engineer` · `rust-builder` (writes) · `rust-reviewer` (audit).

Represent phases 1 → 2 → 3 → 4 → 5 in the host's task surface when available and assign each to
its owning role. Collect worker results through the host's result channel; the lead synthesizes
and advances the chain.

## Phase 1 — Design
- **Recall first:** `/recall <API area>` (or reuse the session-start memory index) and paste
  what binds — prior API decisions, semver constraints, gotchas — INTO the team spawn prompts
  (teammates do not inherit session context); say when a recalled note changes the approach. If
  nothing surfaces, proceed (`references/memory-protocol.md`).
- Task owned by `api-design-lead` (with `api-designer` + `error-architect` as teammates) to
  draft the surface: types, traits (sealed?), method signatures, ownership/borrowing at the
  boundary, `#[non_exhaustive]` choices, and the error type.
- Present **2–4 API options** with trade-offs (ergonomics vs. flexibility vs. semver cost).
- **Gate:** prompt the user — choose the shape before anything is written. This is a
  genuine direction-changing fork; batch all design questions into one ask.

## Phase 2 — Architecture check (blocked by 1)
- `api-design-lead` confirms boundaries with `chief-architect` if the API spans crates or
  affects layering. Record an ADR (`/adr`) for non-trivial decisions.
- Draft the API design doc (`references/templates/api-design-doc.md`).
- **Gate:** prompt the user — approve the design doc before build begins.

## Phase 3 — Build (blocked by 2; parallel where independent)
- `rust-builder` implements the surface + the error type (all writes go through it). Public
  items get rustdoc with `# Errors`/`# Panics`/`# Examples` doc-tests.
- In parallel — create sibling tasks so they run concurrently — `test-engineer` drafts
  integration + property tests against the public API; `docs-engineer` drafts the crate-level
  docs / README section. Each delegates its writes to `rust-builder`.
- Report a diff summary to the user; proceed to Phase 4 without a gate.

## Phase 4 — Validate (blocked by 3)
- `rust-reviewer` audits the diff. `api-design-lead` runs **API-GATE**.
- Run semver/API checks: `cargo public-api` / `cargo semver-checks` (see `/api-review`);
  flag any breaking change. Run `cargo nextest run` (fall back to `cargo test`) + doc-tests
  + `cargo clippy --all-targets --all-features -- -D warnings`; cite output.

## Phase 5 — Sign-off (blocked by 4)
- Summary: the final surface, semver impact, docs status, test evidence. Every teammate's
  contribution ends in **COMPLETE / NEEDS WORK / BLOCKED** with evidence.
- **Persist what settled:** sweep ALL teammate verdicts for `MEMORY:` lines and run `/remember`
  for each (it dedups); `/remember` team-level decisions (API shape, semver call) too — or state
  "nothing durable" (`references/memory-protocol.md`).
- Verdict **COMPLETE / NEEDS WORK / BLOCKED**. Next steps: `/api-review` before release,
  `/changelog`, `/publish`.
- Close workers through the host's lifecycle API when one exists.

## Error recovery
Any agent returns **BLOCKED** → surface it, don't proceed past it (its dependent tasks stay
blocked), prompt the user (skip & note / retry narrower / stop and run the prerequisite).
Keep completed work.
