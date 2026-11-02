<!-- Rust Code Studio task plan. Written by /spec-tasks into .rust-studio/specs/<slug>/tasks.md. -->

# Tasks: <feature name>

- **Spec:** [`spec.md`](spec.md)
- **Updated:** `YYYY-MM-DD`

Status: ☐ todo · ◐ in-progress · ☑ done · ⊘ blocked

Use unique IDs (letters, digits, `_`, `-`). Dependency and conflict cells contain IDs separated
by commas/spaces, or `—` for none. Dependencies are prerequisites; conflicts prohibit concurrent
work, not sequential work. Declare overlapping write sets even when no dependency exists.

| # | Outcome | Owning role | Review role | Expected paths | Depends on | Conflicts with | Acceptance | Status |
|---|---------|-------|----------|----------------|------------|----------------|------------|--------|
| 1 | *reviewable outcome* | `rust-builder` | `rust-reviewer` | `crate/src/...` | — | — | *criterion or command* | ☐ |
| 2 | *…* | *…* | *…* | `crate/tests/...` | 1 | — | *…* | ☐ |

## Shared contracts and notes

Record only interfaces, assumptions, or discoveries that another task needs. State the producer,
consumer, and source when an interface crosses task boundaries. A scope or product change goes to
the owning lead, not to the next implementer by default.

## Execution evidence

For a completed task, link the destination revision or diff, commands run, and facts a dependent
task must know. Missing evidence is unknown. External issue, PR, and merge state remain separate.
