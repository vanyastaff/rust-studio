---
name: team-api
description: "api design ship public surface — design and ship a public Rust API end-to-end with the API team: api-design-lead, api-designer, error-architect, docs-engineer, and test-engineer — through design, build, docs, and a semver/API review. Use to add or change a crate's public surface."
argument-hint: "[the API/feature to design, e.g. 'a streaming Decoder type']"
user-invocable: true
---

# /team-api — design & ship a public API

Orchestrate the API team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.** Gate at phase boundaries (quality gates,
not permission loops) — decide tactical calls yourself with a one-line rationale.
Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`.

## Team composition
`api-design-lead` (owns API-GATE) · `api-designer` · `error-architect` · `docs-engineer`
· `test-engineer` · `rust-builder` (writes) · `rust-reviewer` (audit).

## Phase 1 — Design
- Spawn `api-design-lead` + `api-designer` to draft the surface: types, traits (sealed?),
  method signatures, ownership/borrowing at the boundary, `#[non_exhaustive]` choices,
  and the error type (with `error-architect`).
- Present **2–4 API options** with trade-offs (ergonomics vs. flexibility vs. semver cost).
- **Gate:** `AskUserQuestion` — choose the shape before anything is written. This is a
  genuine direction-changing fork; batch all design questions into one ask.

## Phase 2 — Architecture check
- `api-design-lead` confirms boundaries with `chief-architect` if the API spans crates or
  affects layering. Record an ADR (`/adr`) for non-trivial decisions.
- Draft the API design doc (`${CLAUDE_PLUGIN_ROOT}/docs/templates/api-design-doc.md`).
- **Gate:** `AskUserQuestion` — approve the design doc before build begins.

## Phase 3 — Build (parallel where independent)
- `rust-builder` implements the surface + the error type. Public items get rustdoc with
  `# Errors`/`# Panics`/`# Examples` doc-tests.
- In parallel, `test-engineer` drafts integration + property tests against the public API;
  `docs-engineer` drafts the crate-level docs / README section.
- Report a diff summary to the user; proceed to Phase 4 without a gate.

## Phase 4 — Validate
- `rust-reviewer` audits the diff. `api-design-lead` runs **API-GATE**.
- Run semver/API checks: `cargo public-api` / `cargo semver-checks` (see `/api-review`);
  flag any breaking change. Run `cargo nextest run` (fall back to `cargo test`) + doc-tests
  + `cargo clippy --all-targets --all-features -- -D warnings`; cite output.

## Phase 5 — Sign-off
- Summary: the final surface, semver impact, docs status, test evidence.
- Verdict **COMPLETE / NEEDS WORK / BLOCKED**. Next steps: `/api-review` before release,
  `/changelog`, `/publish`.

## Error recovery
Any agent returns **BLOCKED** → surface it, don't proceed past it, `AskUserQuestion`
(skip & note / retry narrower / stop and run the prerequisite). Keep completed work.
