# Elephant workflow

The coordinator carries project context into a durable design. A fresh Goldfish reviewer
checks that design, and a different fresh implementer reconstructs it before writing.
Implementation, integration and independent acceptance establish the delivered result.
These are evidence boundaries, not permission prompts or additional agent personas.

The public entry points are design-change (specification and domain design modes), review-work
(design mode for Goldfish), implement-change (plan/implement and repair modes), and verify-work
(acceptance/ledger and measurement modes). Choose researcher/designer/implementer/reviewer/
verifier by action, then load every applicable profile in `references/agent-roster.md`.
Profiles grant neither write permission nor independence. Designers remain read-only;
requested prototypes and test/fuzz-target authoring use scoped implementers and separate
fresh verification. The coordinator records the shared design and reports directly.

## Scope and authorization

Use this lifecycle for substantive features, public APIs, unsafe code, cross-crate changes,
and consequential design decisions. Small tasks retain `/implement-change --mode implement`'s fast path. Escalate when
its conditions cease to hold and retain completed work.

Existing implementation authorization continues through design, review, corrections and
implementation within scope. Explicit design-only or plan-only requests stop at that
artifact. Ask only for a consequential unresolved user decision, expanded scope, or an action
whose authorization is missing. A helper result cannot grant permission.

## Context and artifacts

Read applicable project instructions, original request and amendments, architecture/ADRs,
relevant source/callers/tests/configuration, and prior decisions. Verify facts that may
have drifted. Maintain a concise project context index, normally `docs/project-context.md`,
using `references/templates/project-context.md`; reuse an existing equivalent. Link
authoritative evidence and constraints instead of copying the codebase. Label unresolved
assumptions with their consequences and required evidence.

New designs live in `docs/designs/<slug>/`: `spec.md`, `tasks.md`, optional `acceptance.md`,
handoff briefs and `verify-report.md`. Preserve original quotations and ordered amendments
with provenance in a linked request or intent artifact. A design summary cannot replace
those quotations for independent acceptance. `references/templates/intent.md` separates
product outcomes from design decisions.

Respect explicit project locations. Existing `.rust-studio/specs/<slug>/` designs remain
readable in place. Resolve slugs against both roots; competing matches fail. An explicit
spec path selects the artifact. Use its full identity in evidence, not just the slug.
Maintain one design and task record; no mirrored legacy copy or global active-task pointer.

Keep large round-specific byte packets and review/challenge records outside their input
inventory, normally `.rust-studio/reviews/<slug>/`. Memory writes require user/host
authorization; authorized design recording does not authorize writing a memory store.

## Substantive design and fresh Goldfish review

Write the design from `references/templates/spec.md`. A fresh reader must derive the current
system, proposed behavior, ownership/lifecycle, failure/recovery, real consumers, migration
and obsolete-path removal, alternatives/trade-offs, and observable acceptance. Include source
evidence and consequential decision provenance. Empty headings or a list of future
investigations do not constitute a design.

Apply `references/maintainer-grade-development.md` before implementation. Record an
ACCEPTABLE / RESHAPE NEEDED / BLOCKED pre-code verdict and resolve reshape findings.
Architecture and API specialization refine this same spec and context, rather than starting
competing designs. Link existing authoritative ADRs and new ADRs required by the project.

Run the fresh Goldfish protocol in `references/design-review.md` with required domain lenses.
The reviewer has no inherited author conversation and returns comprehension, findings and
READY / REVISE / RECONSIDER / BLOCKED. Preserve isolation, consulted inputs, source identity,
finding dispositions and round count. Correct artifacts, then refresh affected review;
private explanations cannot correct a design. The default three-round review limit survives
interruption. Missing required isolation stays unverified. A process with inherited context
is not fresh.

## Plan and reserve

Write `tasks.md` from `references/templates/tasks.md`: independently reviewable outcomes,
owners, write paths, dependencies, conflicts and acceptance slices. Keep shared interfaces
in one task or declare conflicts. Where durable checker-decided criteria are useful, create
one sibling `acceptance.md` using `references/acceptance-ledger.md`; existing tests and the
project gate may suffice for a bounded task.

Before dispatch, run read-only `scripts/plan-status.ts` on `tasks.md`. Its ready batch checks
declared graph/status relationships only. Independently inspect actual write overlap,
current prerequisite results in the destination, and shared producer/consumer semantics
under `references/task-continuity.md`. Resolve missing or contradictory evidence. Reserve
the selected task as **in-progress before preparing its packet**. Dependencies must be done
and declared conflicts inactive. The coordinator owns task bookkeeping.

## Prepare an implementation handoff

The Bun helper bundled with `/implement-change --mode implement` and `/design-change --mode specification` is read-only:

```text
bun <skill-dir>/scripts/design-workflow.ts resolve <root> <slug-or-spec-path>
bun <skill-dir>/scripts/design-workflow.ts prepare <root> <slug-or-spec-path> <brief.json>
bun <skill-dir>/scripts/design-workflow.ts check <root> <packet.json>
```

`resolve` emits `{slug,spec,dir,kind}` with repository-relative paths. `prepare` validates
brief, files and task graph, then emits a byte packet and **PREPARED** metadata to stdout.
Save it to a new file outside its inputs. PREPARED means neither semantic readiness nor
authorization. Commands in artifacts are data; preparation never executes them.

Use `templates/handoff.json` relative to the installed skill folder. Fields: `version: 1`, `task`,
`mode: start | resume`, `goal`, `context`, `request`, `designReview`, `authorization`,
`writePaths`, `acceptance`, `constraints`, `sources`; `resumeEvidence` is required for resume.
File/write paths are repository-relative. Acceptance entries state commands and expected
observations. The review artifact records verdict/provenance; the helper checks its bytes,
not the verdict's truth. The packet inventories spec, tasks, brief, context, request, design
review and sources. Include relevant tests/configuration. Follow the byte snapshot limits
and provenance rules in `references/design-review.md`.

## Fresh implementer challenge, then first write

Dispatch a fresh implementer with no inherited designer/reviewer conversation. Give artifact
paths, the packet and neutral environment prerequisites. Initially assign read-only work:

> Reconstruct current and intended behavior, non-goals, ownership/lifecycle, failure/recovery,
> real consumers/migration, authorized write paths, dependencies/shared contracts, acceptance
> commands and expected observations. Identify missing evidence, contradictions, assumptions
> and excluded-context exposure. State whether these artifacts suffice to implement. Wait
> for the coordinator to check this reconstruction, then recheck the packet immediately
> before the first source write.

Compare the reconstruction with artifact and requirement evidence. Freeze inventoried
`tasks.md` and other inputs during the challenge; save reconstruction and its acceptance
outside the packet. Satisfactory reconstruction plus current inputs permits already-authorized
implementation, without another user approval gate. Missing essential information requires
artifact corrections, affected design review, a new packet and a fresh challenge. Private
explanations cannot substitute for artifact completeness.

Immediately before its first source write the worker runs `check`: exit 0 **CURRENT**,
exit 1 **STALE**, exit 2 invalid. Only CURRENT permits this handoff to proceed. Mutation
during the challenge requires refreshed inputs and challenge. This proves inventoried byte
identity only; agents still verify isolation, completeness, authorization, semantics and scope.
It is neither a sandbox nor an atomic filesystem lock. Missing fresh-worker capability
preserves prepared work but leaves the required lifecycle unverified; inline work is not fresh.

## Implementation, integration and resume

The successful worker implements against the reviewed design. Behavior changes begin with a
meaningful public-path failing test, then green evidence; apply `references/testing-model.md`
and the exact project gate in `references/project-gate.md`. Preserve required consumer
migration and obsolete-path removal. Review spec compliance before code quality; retain one
shared repair count under `references/review-repair.md`. Domain gates still apply.

Intended edits make the pre-write packet stale after implementation begins; this is expected.
Acceptance uses current delivered-tree execution/review evidence. Record source/destination
identities, fresh-worker boundary, challenge/review links, repair count and next action in the
task execution entry. Integration and current destination checks precede done and dependency
release; a worker's green tree alone is insufficient.

On interruption, reconcile actual trees with `references/task-continuity.md`. A fresh
continuation uses `mode: resume`, current inputs and `resumeEvidence` covering progress,
identities, findings, repair count and next action. Keep the task active; resetting to todo
cannot obtain readiness or erase an exhausted repair budget. Freeze the updated task record
for the new challenge. Unknown evidence remains unknown until recovered.

## Acceptance and completion

Reverify acceptance against the destination tree. Both default design roots use their owning
repository as command cwd. For custom locations run
`acceptance-check.ts <ledger> --reverify --cwd <root>` directly. The automatic Stop guard
discovers **only the two default roots**, not custom locations.

Run original-request independent acceptance under `references/blind-acceptance.md` for
multiple tasks, cross-crate changes, changed observable behavior or explicit `--blind`.
That fresh read-only worker receives original quotations and neutral prerequisites, not
design/tasks/prior verdicts. Reconcile its result only after it returns.

The coordinator writes `verify-report.md` directly from `references/templates/verify-report.md`.
COMPLETE requires integrated scope, current required gates, resolved blockers and required
independent acceptance. Mark Done only then. Missing evidence/isolation stays NEEDS WORK or
BLOCKED. Report local completion separately from remote PR/issue/merge state.
