<!-- Rust Code Studio template — task breakdown for a spec. Written by /spec-tasks into .rust-studio/specs/<slug>/tasks.md. Each task is implemented via /dev-task. -->

# Tasks: <feature name>

- **Spec:** [`spec.md`](spec.md)   ·   **Updated:** `YYYY-MM-DD`

## Task list
*Ordered. Each task is small enough for one /dev-task. This table is the durable,
human-readable record; when agent teams are active (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)
each row is mirrored into a `TaskCreate` item — `#` ↔ task id, `Owner lead` ↔ `owner`,
`Status` ↔ pending/in_progress/completed, `Blocked by` ↔ `addBlockedBy` (see coordination
protocol §8). The file stays the source of truth; the shared task list is the live surface.
Status: ☐ todo (pending) · ◐ in-progress · ☑ done (completed) · ⊘ blocked.*

| # | Task (outcome) | Acceptance slice | Owner lead | Blocked by | Status |
|---|----------------|------------------|------------|------------|--------|
| 1 | *…* | *which spec criteria this satisfies* | `<lead>` | — | ☐ |
| 2 | *…* | *…* | `<lead>` | 1 | ☐ |
| 3 | *…* | *…* | `<lead>` | 1 | ☐ |

## Critical path
*The ordered chain that gates completion: e.g. 1 → 2 → 5.*

## Cross-crate ripples
*Changes that force updates elsewhere (downstream crates, docs, tests) — coordinated by
`product-steward` so nothing is dropped.*

## Notes
*Blocked-task reasons and their unblock step (e.g. "needs ADR — run `/adr`").*

## Shared contracts
*Only actual shared files/interfaces. Compare producer, consumer and tests before dispatch;
name the semantics, source and any unresolved conflict. Distinguish planned from implemented.*

| Producer task | Consumer task | Contract + source | Compatible / conflict |
|---------------|---------------|-------------------|-----------------------|
| *…* | *…* | *absence/error meanings, units, ownership, ordering where relevant* | *…* |

## Execution entries
*One entry per task, linked to its status row above (do not duplicate the status database).
The coordinator updates this before repairs and whenever downstream-relevant facts change.*

### Task <id>
- **Source:** worker / worktree / branch / commit + relevant dirty-diff identity.
- **Destination:** agreed worktree / branch / integrated revision + dirty-diff identity.
- **Acceptance evidence:** criteria → exact commands/results/artifact pointers and tested tree;
  missing checks stay unverified. Worker evidence is not destination evidence.
- **Review/repair:** original review and finding IDs; dispatch count (maximum three shared
  across review stages); open/blocking/advisory/resolved findings and latest repair evidence.
- **Discoveries for dependants:** fact / source pointer / affected task IDs; resolved contract
  changes and consequences for their briefs. No secrets or pasted log dumps.
- **Integration / next action:** what landed, what needs reconciliation or refreshed evidence.
- **External state:** observed tracker/PR status; synchronization or merge pending separately.

*On resume reconcile entries with actual trees; preserve user work and counts. Missing history
is unknown, never zero. Only integrated work with current required evidence unblocks dependants.*
