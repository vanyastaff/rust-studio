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

## Phase 1 — Explore
1. Restate the goal in one line; confirm if fuzzy.
2. `/recall <area>` to surface prior learnings; spawn `rust-scout` to map the affected code,
   existing types, and tests. Scout uses serena MCP for symbol/reference navigation and `rg`
   for macro-generated or `cfg`-gated sites — never Bash `grep`/`find`. Note constraints
   (MSRV, no_std, async runtime, public surface).

## Phase 2 — Propose
3. Spawn the owning lead (or `chief-architect` for cross-crate/architectural work) to draft
   **2–4 approaches** with trade-offs (effort, risk, semver cost, perf, testability). For a
   non-trivial or hard-to-reverse approach, also spawn **`harsh-critic`** to attack the
   recommended option (premise, failure modes, simpler alternative) before the gate — no
   echo-chamber; fold real findings into the options.
4. **Gate:** `AskUserQuestion` — pick the approach. For a hard, costly decision, record an
   ADR (`/adr`).

## Phase 3 — Spec
5. Slugify the feature. Draft `.rust-studio/specs/<slug>/spec.md` from
   `${CLAUDE_PLUGIN_ROOT}/docs/templates/spec.md`: problem, goals/non-goals, chosen approach +
   alternatives, public-surface & semver impact, **acceptance criteria** (a checklist — this
   is what `/spec-verify` checks), risks, and links (ADR, recalled memory).
6. **Gate:** show the draft; get approval before the write (delegate the write to a sub-agent).

## Output
Confirm the spec path and summarize the approach + acceptance criteria. Verdict
**COMPLETE / NEEDS WORK / BLOCKED**. Next: `/spec-tasks <slug>` to break it down. Offer to
`/remember` the key decision so it survives to future sessions.
