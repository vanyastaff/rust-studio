---
name: spec-tasks
description: "Use when a Rust spec needs a local task plan with dependencies, file ownership, and status."
---

# /spec-tasks — plan and coordinate a spec

Turn `.rust-studio/specs/<slug>/spec.md` into the local plan
`.rust-studio/specs/<slug>/tasks.md`. Use this for a multi-step or cross-session change. A single
bounded change belongs in `/dev-task`; this skill does not create GitHub issues, worktrees, or
agents by itself.

## Make the plan

Act as the coordinator. Read the spec, affected code, `references/agent-roster.md`, and
`references/delegation.md`. Write `tasks.md` from `references/templates/tasks.md` with one task
per independently reviewable outcome. Each row records the owning agent role, any independent
review role, expected paths, dependencies, conflicts, acceptance slice, and status. Choose the
smallest role that owns the work; add a review role only when its gate or independent judgment
changes acceptance. Keep a shared interface in one task or list it as a conflict; a dependency
graph alone does not prevent two writers from changing the same file.

Use `/acceptance` only when criteria need executable, durable evidence. Do not add a ledger for a
task that existing tests and the project gate already prove.

When implementation is authorized, start ready tasks through `/dev-task`. Dispatch separate agents
only after checking that both their dependencies are met and their expected file sets do not
overlap. A worker brief names the task, role, paths, constraints, acceptance evidence, and result
to report. Run dependent or conflicting tasks in sequence. The owning lead resolves scope or design
changes; the reviewer stays independent of the implementation. `references/delegation.md` defines
when a handoff earns its cost.

## Resume and status

Treat `tasks.md` as the task record. On resume, compare a completed row with the destination
checkout and current evidence before unblocking a dependent task. Preserve current evidence and
report unknown evidence as unknown. A task being done does not close an external issue or merge a
branch.

For a deterministic summary, run the bundled read-only helper:

```bash
bun "scripts/plan-status.ts" .rust-studio/specs/<slug>/tasks.md
```

It validates the table and dependency graph before reporting status; malformed rows, unknown
statuses/references, duplicate ids and cycles exit with code 2 and no readiness result. IDs may
contain letters, digits, underscores and hyphens; reference lists use commas or spaces. Use the
template's status symbols or `todo`, `in-progress`, `done`, `blocked`.

`ready` is a deterministic batch in table order: dependencies must be done, and no member may
conflict with an active task or another batch member (either direction counts). This checks
declared conflicts, not actual path overlap, requirement coverage or acceptance evidence;
verify those before dispatch. Use `--json` for tools. When the plan changes, update its rows.

## Output

Report the plan path, ready tasks, critical dependency chain, and any blocker. End with
**COMPLETE**, **NEEDS WORK**, or **BLOCKED**.
