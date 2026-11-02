# Evaluate Studio instructions

Use this procedure for `maintain-studio evaluate`. Measurement writes evaluation artifacts;
instruction edits require the explicitly requested improvement branch in
`references/procedures/studio-improve.md`.

## Select and isolate

Resolve the full plugin root and check that `tools/eval-runner.ts`, `benchmarks/fixtures/`
and Claude Code execution are available. The runner uses Claude Code; another host may
prepare inputs or invoke that supported runner if available, but cannot replace it with an
in-context self-review. If execution is unavailable, retain preparation and report BLOCKED.

Enumerate `benchmarks/fixtures/**/ground-truth.md` and apply the requested folder/case filter;
list the selected cases before spending. Every fixture has ground truth, while its input is
either `input.rs` or a complete `src/` tree. Keep the oracle private from the worker under
test. For a multi-file case, extract only its calibrated audit prompt from the oracle and
give the worker that prompt and the whole source tree, so the measured task stays intact.

Use the fixture mapping in `tools/eval-runner.ts` as the canonical role/profile selection.
Available roles are researcher, designer, implementer, reviewer and verifier; load the
mapped domain profiles without changing model routing. Run each fixture in a fresh worker
context, source-only and read-only regardless of its role. Independent fixtures may run
concurrently within the declared budget. On a host using team tasks, collect outputs and
close the workers when the run ends. Use native output so the role's verification ritual
is exercised. Missing ambient MCP tooling follows `references/tooling.md`'s degradation
contract; it must not silently reduce the claimed coverage.

## Execute and score

Inspect the existing runner's supported options before constructing a command. From the
plugin root, `bun tools/eval-runner.ts --fixture <folder/case> --dry-run` previews one case;
repeat `--fixture` to select more. `--fixtures` means all fixtures. Use explicit `--runs`,
`--parallel`, `--budget`, `--total-budget` and a unique `--out` directory for a measured run.
With no selectors the runner can run the entire suite, so inspect its dry run first.
Account-enabled `claude plugin eval <plugin-root> --no-publish` is the separate suite path;
the in-session fixture path and existing runner do not require plugin-eval enablement.
Neither a dry run nor a successful test fixture authorizes edits or external actions.

Budget reporting follows `references/procedures/studio-improve.md`'s budget contract even
for measurement: the runner's total budget is not a hard ceiling, and missing grader cost
is not zero. Stop dependent execution if a requested hard cap cannot be enforced.

Score each selected fixture against its unchanged oracle after collecting its native output:

| Fixture mode | Required evidence |
|---|---|
| Defect recall | Mark each planted row caught or missed by defect type and line vicinity; recall = caught / planted. |
| First-pass bar | Also require the declared rejection verdict, RESHAPE NEEDED or REDO-TO-BAR. A missing verdict or ACCEPTABLE fails even when some defects were named. |
| Map recall | Every expected file:line row must be present; no verdict token is required. |

Adjudicate unmatched findings as genuine additional defects or noise rather than equating
every unmatched finding with a false positive. Check that performance findings name the
benchmark verification and soundness findings name Miri execution or a skip reason.
Missing verification is a prompt gap. Keep incomplete, timed-out and errored runs visible.

## Report

Report fixture, role/profile, mode, required/observed verdict, caught/planted, missed IDs,
adjudicated false positives, execution scope, model, cost and artifact paths. Aggregate by
role/profile without erasing individual cases. A role/profile is **SOLID** only with complete
recall, all required verdicts and no noise; otherwise **NEEDS PROMPT FIX** with each miss
and a suggested one-line instruction change. Make a missing rejection verdict the headline
failure. Proposals stay unapplied in measurement mode. New fixtures need source and an
independently checked oracle; preserve the calibrated prompt and runner mapping coverage.
