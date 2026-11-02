# Spec: Elephant workflow integration

- **Status:** Done; evidence in `verify-report.md`
- **Slug:** `elephant-workflow`
- **Owning lead:** chief-architect
- **Review roles:** harsh-critic, qa-lead

## Problem and intended outcome

The user requested a complete Elephant lifecycle integrated with existing Rust Studio,
including project context, durable design, fresh-agent handoff and implementation. They
also authorized removing obsolete, weak or duplicate skills/agents and migrating consumers.
The previous change added fresh document review, drift review and byte snapshots. It did
not connect context and design to a new implementation worker.

## Scope and alternatives

Keep `/dev-task` as the implementation coordinator. `/spec` owns design and exploration;
`/doc-review` owns design review; `/spec-verify` owns full requirement acceptance. Explicit
design-only requests stop at the design. Already-authorized implementation continues.

Considered replacing all 61 skills with three generic commands: rejected because domain
discovery, user-invoked operations and independently installable specialist skills have
different contracts. Keeping every existing phase command would preserve duplicated
orchestration. Retire `/brainstorm` into `/spec --explore`, and `/spec-tasks` into
`/dev-task --plan`. Keep specialist agents with distinct policy, implementation or independent
review responsibilities. Remove duplicate permission loops and clerical agent dispatches.

## Design

1. A shared Elephant protocol owns context loading, evidence-based decisions, design sections,
   fresh handoff, interruption/resume and completion semantics. Existing skills are its entry
   points. A concise project context index links authoritative architecture, constraints,
   sources/tests/configuration and design history; it does not duplicate every source file.
2. New durable designs use `docs/designs/<slug>/`: `spec.md`, `tasks.md`, optional
   `acceptance.md`, handoff briefs and `verify-report.md`. Respect explicitly supplied project
   paths. Large byte packets stay local under `.rust-studio/reviews/`. Existing local
   `.rust-studio/specs/<slug>/` artifacts remain readable in place. Slug resolution fails
   on competing new/legacy designs; an explicit path selects one. Never synchronize two copies.
3. An executable read-only helper resolves design artifacts and prepares a handoff packet
   from a ready task, scoped brief, design/context/request evidence and source inventory.
   Output is PREPARED, not authorization or semantic readiness. Reuse the existing plan
   parser and byte snapshot implementation. Missing artifacts,
   non-ready tasks, malformed briefs, conflicting identities and stale snapshots cannot
   become a ready handoff. Commands in artifacts remain data, never implicitly executed.
4. A fresh implementation worker receives artifact paths and neutral runtime prerequisites,
   with no inherited author/reviewer conversation. Before writes, it reconstructs behavior,
   constraints, ownership and acceptance evidence from those artifacts. The coordinator
   checks this response. Essential clarifications are written into the design and affected
   review is refreshed; private explanations cannot count as successful handoff.
   Dispatch order: the coordinator checks syntactic readiness, actual write-set overlap,
   current prerequisite evidence and shared contracts; reserves the task as in-progress;
   then captures the packet. While reconstruction is pending, it freezes inventoried task
   bookkeeping and records the challenge outside the packet. The worker rechecks freshness
   immediately before its first source write after the coordinator accepts the reconstruction.
   Source mutation during that interval prevents writing and requires a refreshed handoff.
   After work starts, intended source/task changes naturally invalidate the input snapshot;
   subsequent acceptance uses the delivered tree, not the old pre-write packet. A fresh
   continuation of an active task uses resume mode and new current inputs, preserves repair
   counters and destination evidence, and never resets the task to todo merely to pass a
   readiness parser. The successful worker then implements. Missing isolation preserves a prepared handoff
   but remains unverified for the required lifecycle; trivial changes retain the fast path.
5. Task status and execution evidence remain in `tasks.md`; the coordinator records source
   and destination identities, fresh-worker boundary, review state, shared repair count and
   next action. Integration and current checks precede done. Code verification, original-
   request acceptance and human authorization remain separate from a CURRENT byte result.
6. Migrate executable consumers: acceptance guard discovers both supported roots, binds
   by artifact path rather than a colliding slug, and keys progress by full artifact identity.
   Acceptance command cwd defaults to the owning repository for either default root.
   Pre-compaction guidance points to canonical artifacts. Bundle helpers for standalone use.
   Custom explicit paths are resolved against the supplied repository root and verified
   directly with `acceptance-check --cwd <root>`; the automatic Stop guard discovers only
   the two default roots. Disclose that boundary rather than claiming custom-root coverage.

## Acceptance criteria

- Public helper tests reject missing/stale/malformed inputs, ambiguous designs and unready
  tasks; legacy and canonical explicit paths resolve without source writes. Cover active
  task resume and input mutation between reconstruction and the first write.
- Acceptance hook regressions prove discovery/binding and command cwd for both roots,
  including same-slug collisions. Existing guard behavior remains covered.
- Custom-path checking uses the explicit repository cwd. A supplied-record evaluation
  rejects dispatch when syntactic readiness hides overlapping write paths or stale
  prerequisite evidence.
- No executable routing, maintained skill, agent or generated catalog invokes retired
  skills; retained names and user-invocation boundaries match the new distribution.
- A dependency-free Rust fixture is handed to a fresh worker using artifacts alone. Record
  its pre-write reconstruction, then run private behavior probes against both library and
  CLI consumer. Missing contract and stale packet cases reject readiness; inherited context
  is never represented as fresh. Distinguish this live evidence from supplied-record evals.
- Existing applicable evals, full Bun suite, distribution/reference/metadata gates and host
  validators pass. Document actual host/platform limitations and pruning rationale.

## Sources and ownership

Existing owners: `docs/design-review.md`, `docs/task-continuity.md`, `docs/blind-acceptance.md`,
`docs/review-repair.md`, `scripts/plan-status.ts`, `scripts/review-packet.ts`, and acceptance
checker/guard. Upstream evidence: `docs/upstream-elephant-goldfish-2026-11.md` and the official
[EGM workflow](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/docs/getting_started.md).
No new Elephant persona, global active-task pointer, automatic memory store or duplicate
acceptance ledger is introduced.
