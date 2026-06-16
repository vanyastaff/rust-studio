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
Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` (§8 team execution).

## Orchestration
When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), run this as a real
team: `TeamCreate`, then spawn the named agents as teammates (`Agent` with `team_name` +
`name` + `subagent_type`) and coordinate via the shared task list (`TaskCreate` one task per
phase, order with `addBlockedBy`, assign with `TaskUpdate owner`) + `SendMessage`. Otherwise
fall back to single-orchestrator delegation: spawn sub-agents sequentially and inline each
phase's context into the spawn prompt. Teammates don't inherit this plan (pass it in the spawn
prompt) and don't get bundled MCP (they rely on the user's ambient serena/exa); status can lag,
so have teammates mark tasks `completed`. Drive `TeamDelete` cleanup at the end (shut teammates
down with `SendMessage {type:"shutdown_request"}` first).

## Progress visibility
The user follows the **task list** to know where things stand — keep it live, do not go silent
until the end. When `progress_tracking` is on (`${user_config.progress_tracking}`, default on), in
**both** team and single-orchestrator mode:
1. At the start, `TaskCreate` one task per phase so the whole plan is visible up front.
2. `TaskUpdate` each task to `in_progress` before you start its phase.
3. The moment a phase produces its result, surface it in one line and `TaskUpdate` the task to
   `completed` — **before** starting the next phase. The user sees intermediate results, not a
   final dump.
4. Keep phases the user is waiting on in the **foreground** — a backgrounded phase reads as a hang.
When off, run the phases without the task-list narration.

## Team composition
`api-design-lead` (owns API-GATE) · `api-designer` · `error-architect` · `docs-engineer`
· `test-engineer` · `rust-builder` (writes) · `rust-reviewer` (audit).

Create one task per phase via `TaskCreate` and chain them with `addBlockedBy` (1 → 2 → 3 → 4
→ 5); assign each to its owning agent with `TaskUpdate owner`. Teammates report results via
`SendMessage`; the lead synthesizes and advances the chain.

## Phase 1 — Design
- Task owned by `api-design-lead` (with `api-designer` + `error-architect` as teammates) to
  draft the surface: types, traits (sealed?), method signatures, ownership/borrowing at the
  boundary, `#[non_exhaustive]` choices, and the error type.
- Present **2–4 API options** with trade-offs (ergonomics vs. flexibility vs. semver cost).
- **Gate:** `AskUserQuestion` — choose the shape before anything is written. This is a
  genuine direction-changing fork; batch all design questions into one ask.

## Phase 2 — Architecture check (blocked by 1)
- `api-design-lead` confirms boundaries with `chief-architect` if the API spans crates or
  affects layering. Record an ADR (`/adr`) for non-trivial decisions.
- Draft the API design doc (`${CLAUDE_PLUGIN_ROOT}/docs/templates/api-design-doc.md`).
- **Gate:** `AskUserQuestion` — approve the design doc before build begins.

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
- Verdict **COMPLETE / NEEDS WORK / BLOCKED**. Next steps: `/api-review` before release,
  `/changelog`, `/publish`.
- If running as a team, drive cleanup: `SendMessage {type:"shutdown_request"}` to each
  teammate, then `TeamDelete`.

## Error recovery
Any agent returns **BLOCKED** → surface it, don't proceed past it (its dependent tasks stay
blocked), `AskUserQuestion` (skip & note / retry narrower / stop and run the prerequisite).
Keep completed work.
