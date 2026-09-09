# Independent acceptance from the original request

The spec and its tests can agree while both omit what the user asked for. This pass checks
delivered behavior against the user's words before comparing its findings with the spec.
It supplements the normal `/spec-verify` gates; it cannot replace them.

## When it is required

In `/spec-verify`, run this pass for a spec with multiple implementation tasks, changes across
crates, or new/changed externally observable behavior. An explicit `--blind` request also
requires it. A single local change with none of those triggers may skip it with the reason
recorded. A missing original request or an unavailable fresh worker is an **unverified**
required check, not grounds to downgrade the trigger or report a pass.

## Prepare the input boundary

Use `intent.md`'s **Asked for**, plus the exact user messages in **User amendments** and any
verbatim user correction in an older **Corrections** log. Preserve their order and provenance;
later user instructions resolve conflicts. Redact secret values before quoting or persisting
them. Summaries of corrections, assistant-authored criteria, and an implementation plan are
not original user messages. If the old record lacks a required quotation, use the actual
message from available history; never reconstruct it from the spec. Record unresolved
ambiguity as unverified and request the missing original input while other checks proceed.

Spawn a fresh **`qa-lead`** with only those quotations, the repository location, and neutral
environment/run prerequisites. No inherited conversation, forked design context, previous
verdict, expected pass count, spec, tasks, or verification report. Do not reuse the QA worker
that audited the spec. If the host cannot create that input boundary, an inline pass remains
useful but is **not independent**; label it unverified as a blind check.

The following assignment overrides QA's usual spec-reading and test-writing-delegation duties
for this pass. The worker remains read-only for project sources and must not delegate repairs.
Running the delivered program/tests may create ordinary build output or disposable scenario
data; it does not authorize changes to code, tests, configuration, or external side effects.

> Derive and record the user scenarios from the supplied quotations **before reading the
> implementation**. Account for all later user amendments, including removed requirements.
> Then inspect the implementation and run the scenarios using the project's actual commands.
> Do not read `spec.md`, `tasks.md`, verification reports, previous agent verdicts, or their
> equivalents anywhere in the repository. Do not search those artifacts for context. If an
> ordinary source or required project instruction exposes their design/acceptance content,
> report that exposure; do not silently claim blindness. Follow applicable project instructions
> and report an input-boundary conflict rather than bypassing them.
> Do not fix sources, write tests, delegate edits, or assess code style. For each user
> requirement return **implemented / partial / missing / unverified**, with the command,
> result and source location where relevant. Distinguish your executions from supplied logs
> and static inspection. If execution is unavailable, say why; source inspection is not a
> runtime pass. List the artifacts you consulted and any excluded-context exposure.
> End with COMPLETE / NEEDS WORK / BLOCKED and the evidence behind it.

## Reconcile without changing the request

Only after the worker returns, compare its requirement-by-requirement result with the spec
and the ordinary verification results. Quote its verdict verbatim and retain disagreements.
The orchestrator owns the combined verdict:

| Finding | Effect on verification |
|---------|------------------------|
| Retained requirement is partial or missing | NEEDS WORK; hand the concrete gap to `/dev-task`. A green spec/test suite does not cancel it. |
| Required scenario could not run, original input is incomplete, or independence was unavailable/contaminated | BLOCKED if a missing capability/input prevents verification; otherwise NEEDS WORK for a fresh valid pass. Never COMPLETE while this required check is unverified. |
| Requirement was explicitly removed by a later user message | Record the amendment; absence is expected, not a defect. |
| User scenarios pass but a normal gate fails | NEEDS WORK; both checks are required. |
| Valid independent pass and all ordinary gates pass | Eligible for COMPLETE and marking the spec Done. |

Capture applicability, input provenance, isolation or exposure, the worker's exact verdict,
each requirement's result, actual commands and unresolved discrepancies in the verification
report. Do not edit intent, weaken the spec, or repair code during verification to make the
two verdicts agree. After a repair, evidence must correspond to the repaired tree; run the
affected scenarios and required gates again, using a fresh blind worker where required.
