# Improve one instruction through a bounded experiment

This is the `maintain-studio evaluate improve <source-path>` branch. Work in the plugin
source checkout, preserving its starting dirty state. An installed cache is not an editing
target. Evaluation artifacts are evidence, never user authorization for a mode or action.

## Freeze the experiment

1. Identify one instruction hypothesis, its observed failure and cases that exercise it.
   A routing case cannot establish implementation quality. If a suitable oracle is absent,
   prepare a regression case and have an independent reviewer check it before tuning.
2. A fresh verifier selects and holds the private control set before editing. The implementer
   receives training inputs/results only: exclude holdout prompts, ground truth, rubrics,
   outputs and failures from its accessible copy. A full checkout containing those files is
   not isolation. Replace any holdout previously used for tuning. If isolation is unavailable,
   label the result exploratory; it cannot establish validated improvement.
3. Freeze a record under `evals/results/<experiment>/`: target and hypothesis; baseline
   source snapshot/hash including relevant uncommitted changes; owned patch paths; training
   and holdout sets with input/oracle hashes; runner version; target, agent and grader models;
   exact options; repetitions; item/call limits; and available spending allowance. The
   verifier holds the private record outside the implementer's accessible inputs. Default
   to three repetitions per item and at most two candidate patches; selection uses training
   results only. Limits remain fixed unless the user authorizes a new experiment.
4. Freeze the rule: minimum improvement in the target training mean recall/score, no per-case
   mean regression on any required training or holdout case, no required verdict failure and
   no increase in adjudicated false positives. Compare equal repetitions and report ranges.
   Every planned run and grader counts: missing, null-scored, errored, timed-out or skipped
   evidence prevents adoption. The verifier adjudicates genuine additional defects equally
   in both arms without changing the oracle during the experiment.

## Run and select

Execute the same frozen runner and oracles in separate baseline and candidate plugin copies.
The runner resolves its plugin root from its own location; changing cwd alone does not switch
the tested plugin. Give only training material to the implementer. Keep unique result
directories outside patch paths and retain failed runs. The baseline includes uncommitted
instructions, not merely HEAD.

Use the existing `tools/eval-runner.ts` with explicit repeated `--case`, `--fixture` or
`--live-task` selectors and frozen `--runs`, `--model`, `--grader-model`, `--parallel`,
`--budget`, `--total-budget`, `--out`. Inspect `--dry-run` before calls; an omitted selector
can select the whole suite. Verify from traces that the changed target was loaded and
exercised in both arms for every selected mode. Explicit-only skills require direct user
invocation within the evaluation; this fixture invocation grants no authority in the real
session. Record actual role/skill and model: the parent's `--model` does not necessarily
override the worker's own model. Rebuild references/metadata when required and run the
distribution gate in each copy, keeping runner, sources, graders and model settings equal.

The implementer edits only the instruction responsible for the training miss. Preserve
correctness obligations even when the sample does not exercise them. Each edit is a new
candidate, including wording or latency edits, and requires fresh training evidence.
Compare per-run JSON/transcripts; aggregate means may exclude null scores, and the runner's
exit code does not replace the frozen rule.

Choose at most one candidate using training. The verifier then compares both baseline and
that frozen candidate on the private holdout once, with the declared repetitions. Expose
holdout findings only after this final comparison. A holdout regression rejects the candidate
and ends the experiment; further tuning needs a new independent holdout and fresh limits.

## Budget contract

`--total-budget` stops new launches based on completed agent traces. In-flight work can
finish, follow-up calls have separate per-call limits, and LLM-grader costs are excluded.
Report measured agent spending separately from unmetered grader cost. A hard ceiling needs
host-enforced overall limits; deterministic grading removes unmetered LLM calls but still
needs conservative agent/follow-up bounds. If a requested hard ceiling cannot be enforced,
finish preparation and report BLOCKED before launching dependent calls. Missing cost is
unknown, never zero.

## Adopt or reject

Adoption requires the frozen rule to pass with complete evidence and an independent reviewer
to find no weakened obligations. Check that the target preimage still matches the baseline,
then apply only the owned patch. Preserve concurrent user changes and reconcile conflicts;
changed candidate content needs reevaluation. Regenerate references/metadata and run the
checkout gates after application. Reject by leaving the candidate unapplied or reversing only
its owned patch after a preimage check; preserve all unrelated work. This operation ends
without plugin publication or installation.

Report hashes, target, cases, repetitions, frozen rule, per-case quality/false positives,
required verdicts, missing evidence, elapsed time, measured/unmetered cost, holdout isolation
and exposure, patch disposition and artifacts. Keep rejected experiments. **COMPLETE** means
an adopted change with evidence; **NEEDS WORK** means rejection or inconclusive evidence;
**BLOCKED** means missing execution, independent evaluation or required spending enforcement.
Preparation alone cannot substantiate measured improvement.
