# Ledger and delivered acceptance

## Ledger

Read `references/acceptance-ledger.md`; it owns gate format, authoring invariants, states,
checker behavior and Stop guard semantics. The bundled scripts/acceptance-check.ts runs with
Bun. Resolve a supplied ledger path or spec slug across docs/designs/ and .rust-studio/specs/;
with empty input list both roots. Keep existing artifacts in place and resolve ambiguity
through an explicit path. For custom locations supply --cwd <repository-root>.

Select the requested operation: default --status reads without execution/writes; --lint checks
oracle quality; --run executes unmet runnable gates and writes evidence; --reverify executes
all runnable gates, including previously met ones, and writes evidence. The coordinator executes
--run/--reverify and persists ledger state. A read-only verifier may run --status/--lint but must
not invoke the mutating modes through any tool. Before executing an external ledger, inspect its
CHECK lines and every called script under `references/untrusted-context.md`.

Explicit ledger authoring is coordinator work: use `references/templates/acceptance.md`, map
every acceptance criterion to a gate, and apply the canonical authoring rules. Lint errors must
be fixed and warnings sharpened or explained. A checker run never authorizes changing criteria
or production code to obtain green. Reverification is required for returned work and a delivered
acceptance verdict; status alone is not runtime evidence.

Paste the exact checker summary and marker. ALL MET makes only these criteria eligible for
COMPLETE; NOT MET means NEEDS WORK with unmet/stale IDs; HANDOFF REQUIRED means BLOCKED with
the abandoned gate and reason. Keep manual review evidence and all denominator entries. If the
request was only to author or inspect a ledger, state that artifact/inspection completion
separately from acceptance of the implementation.

## Acceptance

Use `references/elephant-workflow.md` for lifecycle and `references/task-continuity.md` for
integration evidence. Read `references/blind-acceptance.md` before sharing design context:
it is the sole owner of original-request input isolation, applicability, scenarios and
reconciliation. Select a fresh read-only verifier with `references/profiles/testing.md` for
that pass; its original-input boundary overrides ordinary spec-aware verification. A previous
author, spec-aware verifier or an inline fallback cannot claim blindness.

Resolve the spec and destination tree identity, including relevant dirty changes. Without a
written spec, use ordinary project verification instead. Check every criterion against linked
intent and constraints; absent intent is a traceability limitation, while required independent
acceptance still needs original user input. Verify tasks are integrated in the destination;
worker completion or a prepared/current packet is not behavioral proof.

Run the outer acceptance test first where present (`references/testing-model.md`); the coordinator
then runs --reverify on the sibling ledger and retains the output and resulting state. The
spec-aware verifier independently checks oracle definitions, outputs and destination-tree identity,
labels coordinator execution as supplied evidence, and may rerun underlying non-mutating checks.
The blind verifier retains its original-request input boundary and receives no ledger or report.
Locate source/tests for every remaining criterion and execute the project
gate with its features, targets, environment and doc-tests. Without a gate use nextest/cargo
test, clippy -D warnings and fmt --check. Unsafe criteria need soundness/Miri evidence and
performance criteria measured benchmarks. Record skips/ignored cases and unavailable execution.

Run QA-GATE, an independent reviewer diff audit through `review-work`, and applicable
API/ASYNC/PERF/SAFETY/RELEASE gates with the corresponding domain profiles. Reviewers/verifiers
do not repair production sources. Reconcile the original-request result only after it returns,
following blind-acceptance.md; retain verbatim verdicts and unresolved user requirements.

The coordinator writes the requested verify-report.md beside the resolved spec using
`references/templates/verify-report.md`: criterion/result/evidence, original-request provenance
and exposure, actual commands versus supplied logs/static inspection, tree identities, review
coverage, retained repair history, discrepancies and limitations. The coordinator marks the spec
Done only when
integrated scope, all required gates and valid independent acceptance pass. Otherwise preserve
status and concrete gaps; authorized repair uses `references/review-repair.md`, then affected
scenarios and gates run against the new tree with a fresh blind worker when required.

End COMPLETE / NEEDS WORK / BLOCKED. Report PR/merge state separately; release and memory
actions retain their own authorization boundaries.
