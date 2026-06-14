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
