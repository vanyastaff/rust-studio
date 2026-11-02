<!-- /implement-change --mode plan writes beside the resolved spec; new designs use docs/designs/<slug>/. -->

# Tasks: <feature name>

- **Spec:** [`spec.md`](spec.md)
- **Updated:** `YYYY-MM-DD`

Status: ☐ todo · ◐ in-progress · ☑ done · ⊘ blocked

Use unique IDs (letters, digits, `_`, `-`). Dependency and conflict cells contain IDs separated
by commas/spaces, or `—` for none. Dependencies are prerequisites; conflicts prohibit concurrent
work, not sequential work. Declare overlapping write sets even when no dependency exists.

| # | Outcome | Owning role | Review role | Expected paths | Depends on | Conflicts with | Acceptance | Status |
|---|---------|-------|----------|----------------|------------|----------------|------------|--------|
| T1 | *reviewable outcome* | `implementer` | `reviewer` | `crate/src/...` | — | — | *criterion or command* | ☐ |
| T2 | *…* | *…* | *…* | `crate/tests/...` | T1 | — | *…* | ☐ |

## Shared contracts and notes

List all required profiles per task/lens; profiles are domain knowledge, not role permissions.
Keep historical role labels/provenance intact and resolve them through the catalog mapping.

Record only interfaces, assumptions, or discoveries that another task needs. State the producer,
consumer, and source when an interface crosses task boundaries. A scope or product change goes to
the coordinator, not to the next implementer by default.

## Execution evidence

Keep one coordinator-owned entry per task: source worker/worktree and revision/diff; destination
and integrated revision/diff; fresh-worker context boundary; brief/packet and reconstruction
paths; current checks/review findings; shared repair count; discovered contracts and affected
dependants; integration state and next action.

Reserve in-progress before preparing the packet. Freeze inventoried tasks.md during the
challenge; save challenge and acceptance outside the packet. Resume active tasks with current
evidence and preserved counters. Intended implementation edits make the input packet stale;
acceptance uses current delivered-tree evidence. Done requires integration and current checks.
Missing evidence is unknown. External issue, PR, and merge state remain separate.
