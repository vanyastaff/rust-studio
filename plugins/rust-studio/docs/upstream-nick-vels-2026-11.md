# Upstream Autopilot review — 2026-11-01

Reviewed `nick-vels/skills` at commit
[`f50d1b1b4e47df67cb59b7d9b40113be6891b3ca`](https://github.com/nick-vels/skills/commit/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca),
including the skill, phase references, executor prompt, Python state tool and its tests.
This is one substantial end-to-end Autopilot workflow, rather than a collection of Rust
coding guidelines. Its [skill metadata](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/SKILL.md)
identifies version 2.2.1 and explicit-only invocation; the
[changelog](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/CHANGELOG.md)
dates that release October 29. Upstream instructions were inspected as evidence. No
upstream skill, installer, script or test was executed.

## Findings and local fit

| Upstream source fact | Rust Studio comparison and proposed adaptation |
|---|---|
| The [manifest phase](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/1-manifest.md) preserves the original brief, amendments and numbered requirements. Gates trace brief → specification → tickets → independent acceptance. | [Blind acceptance](blind-acceptance.md), [spec](../skills/spec/SKILL.md) and [acceptance ledger](acceptance-ledger.md) already preserve independent user intent and observable completion. Keep these owners. For larger plans, stable requirement identifiers would make omissions easier to check; avoid imposing a second manifest on small changes. |
| The [plan phase](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/4-plan.md) and [`check_plan`](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/tools/ap.py#L357) validate requirement coverage in both directions, known dependencies, dependency-before-consumer waves and disjoint same-wave path prefixes. | [Task planning](../skills/dev-task/SKILL.md) already describes ownership, dependencies and conflicts, but [plan-status](../scripts/plan-status.ts) currently summarizes readiness without validating the graph. Highest-value adaptation: reject malformed plans before reporting ready tasks. Optional requirement coverage can follow once the local task format defines it. |
| The [executor handoff](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/5-subagents.md) passes paths to the ticket, relevant spec headings and shared interfaces, then requests a short result containing files, verification, requirements and concerns. Interface discoveries return to the coordinator. | [Task continuity](task-continuity.md) already captures discoveries and requires integration verification before dependent work. Reuse that record and the existing handoff contract. Keep briefs scoped to relevant sections; an arbitrary 25-line response limit is unnecessary. |
| [Resume](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/0-resume.md) checks whether completed-task commits remain ancestors of HEAD, then reconciles interrupted work. | Studio already requires commit/diff identity, source and destination, dirty work and acceptance evidence. Ancestry is useful evidence, but rebases and cherry-picks need content reconciliation. Preserve Studio's richer identity and protection of unpublished edits. |
| [Review](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/6-review.md) separates manifest coverage, specification conformance and craft. Missing information never supplied to an executor requires correcting the upstream contract before another implementation attempt. | [Review repair](review-repair.md) already preserves findings, blockers and verification across retries. Make the source of a failure explicit where useful. Retain Studio's single persisted repair budget instead of adding upstream's separate repair/retry counters. |
| The [final phase](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/8-final.md) gives a fresh checker only the original brief and amendments, and asks it to run the product in a clean checkout. | Studio's blind acceptance already covers independence, contamination, missing and unverified outcomes. Keep that stronger completion contract. Use a clean checkout when it improves reproducibility; preserve required test configuration without importing upstream's instruction to copy `.env`. |

## Concrete validation lessons

Version 2.2.1 fixed three state-tool failures: help rewrote state, absent counters became
zero and cleared failed gates, and dependency parsing extracted numbers from unrelated
identifiers. Its [tests](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/tests/test_ap.py)
check unchanged state bytes after rejected counts and help, and detect lost commit ancestry.
These are useful behavioral regression patterns, independent of the dashboard implementation.

Static inspection of Studio's current `plan-status.ts` found analogous input weaknesses:
`E34` is silently omitted by the numeric dependency regex, unknown status text becomes
`todo`, malformed task rows are skipped and duplicate identifiers overwrite entries in
the readiness map. Cycles and dangling references lack explicit diagnostics. First reproduce
these through the public CLI; then validate the complete table and graph before deriving
readiness. Include invalid-input exit status and unchanged source bytes in acceptance tests.
The existing two unit tests cover a valid plan and a missing table, not these cases.
This observation describes the inspected baseline, before any follow-up implementation.

The 0.60.0 follow-up adds public-CLI invalid-input regressions and strict table/graph
validation. Its ready batch handles mutual conflicts without deadlocking pending tasks.
Ten new checks failed before the repair; all 13 plan-status tests pass afterward.
Requirement coverage and actual path overlap remain coordinator checks, not parser claims.

Upstream's tool is not itself a reliable completion gate in every branch. In
[`cmd_numbers`](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/tools/ap.py#L915),
blind acceptance rejects `matched > checked`, but sets G4 from the absence of mismatch
messages rather than requiring matching counts. In
[`cmd_finish`](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/tools/ap.py#L956),
unfinished tickets become notes while finalization still proceeds. These are source-level
observations, not locally reproduced runtime defects. Adopt fail-closed validation while
retaining Studio's acceptance-ledger evidence and incomplete-outcome rules.

## Keep upstream-specific choices separate

- The [planning heuristics](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/4-plan.md)
  use roughly 3,000 changed lines per executor and restrict point reviews by task class.
  These are author calibrations, not portable quality thresholds. Size work by coherent
  outcomes, interfaces, risk and verifiable scope.
- The [skill's fixed delegation and approval rules](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/SKILL.md)
  assume an orchestrator that never writes product code, fresh agents for every ticket and
  renewed confirmation for external actions. Studio should follow the current host's
  capabilities, available models and the user's existing authorization.
- The [state/dashboard instruments](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/skills/autopilot/phases/0-instruments.md)
  add an owned `state.js`, web server and committed run directory. Importing them would
  duplicate Studio's durable task state. Improve validation at the existing owner instead.
- The [changelog](https://github.com/nick-vels/skills/blob/f50d1b1b4e47df67cb59b7d9b40113be6891b3ca/CHANGELOG.md)
  also corrects earlier duplicated usage accounting. Treat reported cost and context
  figures as project-specific measurements; validate any local optimization independently.

## Verification boundary

This report compares pinned upstream source with the local workflow documents and scripts.
It does not establish upstream runtime reliability, host compatibility or measured cost
savings. Proposed adaptations require Studio's own reproducers, contract checks and
packaging validation. No new agent, skill, runner or approval ceremony is needed to apply
the strongest findings.
