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
2. Spawn **`product-steward`** to decompose into ordered tasks. Each task gets: a one-line
   outcome, its slice of the acceptance criteria, the owning lead, dependencies, the files it
   is expected to touch, and a rough size. Identify the critical path and cross-crate ripples;
   flag any task that will need `chief-architect` or `api-design-lead` sign-off.

   **Size every task to one context window.** A task is a *vertical slice* — it compiles,
   its tests pass, and it leaves the tree shippable on its own. Too large and it exhausts the
   window mid-build, and the model starts circling and breaking what already worked; too small
   and the slices cost more to coordinate than to write. "Small" is not the bar — *fits in one
   window, ships on its own* is.

   Record the expected files per task: Phase 3 needs them to decide what may run in parallel.
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
   surface is live.

   **One task, one fresh context.** Where the host provides workers, dispatch each task to its
   own, seeded with just what that task needs: the task row, its slice of the criteria, the
   relevant spec sections, and the paths it will touch. Carrying one task's exploration into the
   next is what makes a long run degrade — the window fills with detail that no longer applies,
   and the model starts re-deciding settled things. Where the host has no workers, clear context
   between tasks instead (`references/sub-agents.md`); the rule is the isolation, not the
   mechanism.

   **Parallelize on disjoint files, not just the dependency graph.** Two tasks with no
   dependency edge can still edit the same file and clobber each other. Run tasks concurrently
   only when their expected file sets do not overlap; otherwise serialize them. State the
   sequencing rationale instead of asking for it.

   **Commit each task as it lands** (`/commit`) — per-task commits are the user's rollback
   points, and they keep a failed task from contaminating the diff of the ones that worked.
5. When a task returns **BLOCKED**, surface it, mark it in `tasks.md` and the host task surface,
   and
   continue with unblocked tasks where the dependency graph permits. See error recovery below.

## Phase 4 — Verdict
6. Summarize: tasks completed, gates passed, evidence (test/clippy output), and what
   remains on the critical path. End with **COMPLETE / NEEDS WORK / BLOCKED**.
7. When all tasks are done, run `/spec-verify <slug>`.

## Error recovery
A task that fails on something mechanical — a build error, a failing test, a lint — gets
**one retry in a fresh context**, with the failure output attached. A second context that
already contains the failed attempt tends to defend it rather than re-read the problem.
A second failure is a real blocker: stop retrying and surface it.

If a task returns **BLOCKED** (missing ADR, undecided design, absent dependency, or a second
failed attempt): mark it in `tasks.md` and surface the blocker immediately. Prompt the user
with options — (a) skip and note the gap, (b) retry with narrower scope, (c) stop and run the
prerequisite skill (e.g. `/adr`, `/architecture`). Completed work is kept: earlier tasks are
already committed, so a blocker never costs the tasks that landed before it.
