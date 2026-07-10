---
name: spec-tasks
description: "Use when an approved spec needs ordered Rust implementation tasks, acceptance criteria, and delivery."
---

# /spec-tasks — break a spec into tasks

Turn `.rust-studio/specs/<slug>/spec.md` into an ordered task list and shepherd it to done.
Orchestrate; delegate writes. Protocol: `references/delegation.md`
(§8 team execution).

## Orchestration
The durable `.rust-studio/specs/<slug>/tasks.md` file is the human-readable record and source
of truth. Mirror its rows into the host's task surface when one exists (id ↔ `#`, owner role ↔
`owner`, dependency ↔ "Blocked by") and keep both views in sync. If the host has no task surface,
drive the file directly. Run independent ready tasks concurrently only when workers are available;
otherwise run them sequentially. Follow **`references/delegation.md` §8**.

## Input
`input` is a spec slug or path. If empty, list available specs under
`.rust-studio/specs/` and ask which to run.

## Phase 1 — Validate spec
1. Read the spec (`input`). If it has no approved acceptance criteria, stop and
   direct the user to `/spec` first.

## Phase 2 — Decompose (gate)
2. Spawn **`product-steward`** to decompose into **small, ordered tasks**. Each task gets:
   a one-line outcome, its slice of the acceptance criteria, the owning lead, dependencies,
   and a rough size. Identify the critical path and cross-crate ripples; flag any task that
   will need `chief-architect` or `api-design-lead` sign-off.
3. Write `.rust-studio/specs/<slug>/tasks.md` from
   `references/templates/tasks.md` (delegate the write). The template's
   columns (`#`, owner lead, "Blocked by", status) mirror the shared task-list shape, so the
   rows map cleanly to host-native task items.
   **Gate (phase boundary):** present the task list and get approval before executing any
   task. If the user wants changes, loop back to step 2.

## Phase 3 — Execute
4. Once approved, mirror the rows into the host task surface when available. Run each ready task
   through **`/dev-task`** (scout → plan →
   approve → build → review with the owning lead's gate), passing the **spec-level outer
   acceptance test** and the task's slice of the criteria as context: the task's inner TDD drives
   toward that one outer test, and it writes its own outer test only if it independently ships
   externally-observable behavior (`references/testing-model.md`). Update both `tasks.md` and the
   mirrored host task status as each task lands — `tasks.md` is the durable record, the task
   surface is live. Decide execution order and parallelism from the dependency graph; state the
   sequencing rationale instead of asking for it.
5. When a task returns **BLOCKED**, surface it, mark it in `tasks.md` and the host task surface,
   and
   continue with unblocked tasks where the dependency graph permits. See error recovery below.

## Phase 4 — Verdict
6. Summarize: tasks completed, gates passed, evidence (test/clippy output), and what
   remains on the critical path. End with **COMPLETE / NEEDS WORK / BLOCKED**.
7. When all tasks are done, run `/spec-verify <slug>`.

## Error recovery
If a task returns **BLOCKED** (missing ADR, undecided design, absent dependency):
mark it in `tasks.md` and surface the blocker immediately. Prompt the user with options —
(a) skip and note the gap, (b) retry with narrower scope, (c) stop and run the prerequisite
skill (e.g. `/adr`, `/architecture`). Never discard completed work.
