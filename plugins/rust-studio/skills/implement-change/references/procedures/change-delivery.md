# Delivery, planning and bounded repair

Read `references/elephant-workflow.md` for substantive work. It owns context, design,
Goldfish review, task reservation, cold implementation challenge, integration, resume and
acceptance. Do not create a second lifecycle or reset review/repair history in this procedure.
The portable helpers are `scripts/design-workflow.ts`, `scripts/plan-status.ts` and
`scripts/review-packet.ts`; consult their usage and the canonical protocol for arguments.

## Select the amount of work

- `plan` or `--plan`: resolve the design, reconcile `tasks.md` using
  `references/templates/tasks.md`, validate with `bun <skill-dir>/scripts/plan-status.ts
  --json <tasks.md>`, and report ready tasks and blockers. Check actual write overlap and
  destination prerequisites beyond the declared graph. Stop before implementation.
- `implement`: use the full lifecycle unless the fast path below applies. Preserve real
  callers, failure/recovery behavior, migration and obsolete-path removal in scope.
- Fast path requires obvious edit sites, no design fork, no public API change, unsafe code,
  cross-crate ripple or new dependency. State why it qualifies. Run relevant checks and a
  code-quality review; behavior changes require red/green. Prose/mechanical edits need their
  relevant checks. Escalate into the full lifecycle if these conditions change.

Use `references/maintainer-grade-development.md` before source edits: ACCEPTABLE / RESHAPE
NEEDED / BLOCKED. Load `references/profiles/implementation.md` and the profiles implicated
by actual callers, such as API, async, platforms, systems, data, web or macros. Reshape at
the owning module instead of hiding a borrow problem with clones or locks. Read-only
designer advice does not implement the change. Required reviews use fresh workers under
`references/delegation.md` and `references/sub-agents.md`.

## Test-first inner loop

Read `references/testing-model.md`, `references/testing.md` and
`references/integrity-and-evidence.md`. The inner loop advances the outer public-path
acceptance test; standalone `test-first` handles one requested behavior per cycle.

1. State input, expected value/effect and boundary case. An implementer with the testing
   profile writes the smallest test that observes it; count selected tests so zero matches
   cannot pass as evidence. Run it and retain the expected failing assertion before the fix.
   An unexpected compile error is not the intended red. A passing test means the behavior
   already exists; investigate or select the next missing behavior.
2. Implement the smallest correct, idiomatic, allocation-aware and borrow-correct change.
   Retain the test's assertions. Run the test to green and the affected suite for regressions.
3. Improve structure with the suite green, rerunning after each meaningful step. Use the
   exact project gate from `references/project-gate.md` and independent quality review.
   Report each red/green observation; a plausible test that was never run is UNRUN.

## Repair-gate loop

`repair-gate` authorizes in-scope repair; a checks-only request uses verification instead.
Read `references/project-gate.md` and `references/review-repair.md` before the first pass.
Use the latter's single durable repair budget, including earlier repairs and resumes;
this loop does not allocate a second budget. Bound this operation to three passes as well.

1. Run the project's actual recipe, preserving flags, feature combinations, environment and
   wrappers. Without one, use fmt check, clippy for all targets with warnings denied,
   nextest (or cargo test), and doc-tests. Record exact commands and selected test counts.
2. Stop if green. Otherwise classify the first root failure: compiler errors use the compiler
   branch of `references/procedures/change-diagnosis.md`; formatting is mechanical; lints
   need a justified idiomatic fix; a failing behavior test requires a causal production fix.
   A contextual lint exception must be narrow and explain the invariant it preserves.
3. Count the repair, rerun affected checks, then the gate. Preserve failing output when the
   budget is exhausted and return NEEDS WORK. A fourth repair needs an explicit new budget.

Keep assertions, tests and intended API behavior intact. A wrong test or an API/behavior
decision outside scope requires a decision before editing it. Green hosted CI does not
override a red local project gate; identify local artifacts/environment defects separately.
If clippy did not actually lint a recently checked package, refresh that package's artifacts
and rerun before claiming a lint pass. Avoid clearing unrelated build caches.

Completion for repairs means the required gate ran on the delivered tree. For substantive
delivery, use the lifecycle's stronger completion contract, including compliance before
quality review, current acceptance and destination integration. Gate green alone does not
prove the design's requested behavior.
