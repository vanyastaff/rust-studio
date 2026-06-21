---
name: spec-tasks
description: "spec tasks break decompose — turn an approved spec into an ordered task list with acceptance criteria, then drive each task through implementation. Use after /spec, before building."
argument-hint: "[spec slug or path]"
user-invocable: true
---

# /spec-tasks — break a spec into tasks

Turn `.rust-studio/specs/<slug>/spec.md` into an ordered task list and shepherd it to done.
Orchestrate; delegate writes. Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`
(§8 team execution).

## Orchestration
The durable `.rust-studio/specs/<slug>/tasks.md` file is the human-readable record and source
of truth. When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), **mirror**
those task rows into the shared task list — the session already has one implicit shared team,
so just `TaskCreate` one task per row (id ↔ `#`, owner lead ↔ `owner`, "Blocked by" ↔
`addBlockedBy`) — and use it as the live coordination surface while keeping `tasks.md` in sync
as each task lands. Otherwise drive the file alone, running each task sequentially. Each task
still executes through `/dev-task` (which itself runs as a team when the gate is set). Shut
teammates down at the end with `SendMessage {type:"shutdown_request"}` (no `TeamDelete`).

## Input
`$ARGUMENTS` is a spec slug or path. If empty, list available specs under
`.rust-studio/specs/` and ask which to run.

## Phase 1 — Validate spec
1. Read the spec (`$ARGUMENTS`). If it has no approved acceptance criteria, stop and
   direct the user to `/spec` first.

## Phase 2 — Decompose (gate)
2. Spawn **`product-steward`** to decompose into **small, ordered tasks**. Each task gets:
   a one-line outcome, its slice of the acceptance criteria, the owning lead, dependencies,
   and a rough size. Identify the critical path and cross-crate ripples; flag any task that
   will need `chief-architect` or `api-design-lead` sign-off.
3. Write `.rust-studio/specs/<slug>/tasks.md` from
   `${CLAUDE_PLUGIN_ROOT}/docs/templates/tasks.md` (delegate the write). The template's
   columns (`#`, owner lead, "Blocked by", status) mirror the shared task-list shape, so the
   rows map cleanly to `TaskCreate` items.
   **Gate (phase boundary):** present the task list and get approval before executing any
   task. If the user wants changes, loop back to step 2.

## Phase 3 — Execute
4. Once approved, mirror the rows into the shared task list with `TaskCreate` (when teams are
   active — see Orchestration). Run each ready task through **`/dev-task`** (scout → plan →
   approve → build → review with the owning lead's gate). Update both `tasks.md` and the
   mirrored `TaskUpdate` status as each task lands — `tasks.md` is the durable record, the
   task list is the live surface. Decide execution order and parallelism yourself based on the
   dependency graph (`addBlockedBy` enforces it for teammates) — state your sequencing
   rationale, don't ask for it.
5. When a task returns **BLOCKED**, surface it, mark it in `tasks.md` (and `TaskUpdate`), and
   continue with unblocked tasks where the dependency graph permits. See error recovery below.

## Phase 4 — Verdict
6. Summarize: tasks completed, gates passed, evidence (test/clippy output), and what
   remains on the critical path. End with **COMPLETE / NEEDS WORK / BLOCKED**.
7. When all tasks are done, run `/spec-verify <slug>`.

## Error recovery
If a task returns **BLOCKED** (missing ADR, undecided design, absent dependency):
mark it in `tasks.md` and surface the blocker immediately. `AskUserQuestion` with options —
(a) skip and note the gap, (b) retry with narrower scope, (c) stop and run the prerequisite
skill (e.g. `/adr`, `/architecture`). Never discard completed work.
