# A bounded instruction-improvement experiment

Explicit `/eval-agents improve <skill-or-agent-path>` extends the existing evaluator. It
changes one instruction hypothesis in the plugin's **source checkout**, never an installed
cache. Default `/eval-agents` remains measurement-only. This workflow is Claude Code plugin
only because it reuses `tools/eval-runner.ts`; no new runner, skill, or self-editing hook is
installed. Results are evidence about the tested models and cases, not a universal speedup.

## Freeze before tuning

1. Resolve one source target and an observed failure, then identify relevant eval cases,
   agent fixtures or live tasks that actually exercise it. A routing case is not proof of
   implementation quality. If no suitable oracle exists, create and independently review a
   regression case before tuning; do not manufacture easy examples to make a score rise.
2. Assign a separate evaluator (read-only `qa-lead`) to select and hold the control set
   **before** any prompt editing. The tuning worker (`rust-builder`) gets training inputs/results only, never
   holdout prompts, ground truth, grader rubrics, outputs or failures. Use fresh contexts and
   copies exposing only the needed inputs; a full repository containing the hidden files is
   not an isolated tuning workspace. If that boundary cannot be maintained, report an
   exploratory comparison, not validated improvement. A held-out case already used for
   tuning must be replaced before the experiment begins.
3. Freeze an experiment record under `evals/results/<experiment>/`: target and hypothesis,
   baseline source snapshot/hash (including relevant uncommitted changes), owned patch paths,
   separate training/holdout sets, input/oracle hashes, runner version, target model and any
   agent model overrides, grader model, exact options, repetitions and limits. The evaluator
   holds the private set and its record outside the tuning worker's accessible input. Default
   to three repetitions per item and at most **two candidate patches**, selected on training
   results only. Bound the number of items and calls; record the available spending allowance
   before launching work and never silently expand it.
4. Freeze the decision rule too: identify the target defect/metric and the minimum gain
   (default: improve its training mean recall/score), require **no per-case mean regression
   on any required training or holdout item**, no required verdict failure, and no increase
   in adjudicated false positives. Compare like repetitions and show ranges; inconclusive
   evidence is not an improvement. Count every planned run and every grader; missing,
   errored, timed-out, null-scored or skipped evidence prevents adoption. Additional genuine
   defects are not false positives merely because the ground truth omitted them: a separate
   evaluator adjudicates them symmetrically, without rewriting the oracle mid-experiment.

## Run baseline, then candidate

Execute the **same frozen runner and oracles** in isolated baseline and candidate plugin
copies. Its plugin root is resolved from the runner's own location: merely changing cwd
does not switch the plugin under test. Preserve the starting dirty tree in the baseline;
do not use HEAD as a substitute for uncommitted instructions. Keep result directories unique
and outside candidate patch paths, never overwrite a previous run. The evaluator's full
copies may contain holdout data; the tuning worker's copy must not.

The evaluator uses explicit repeated selectors (`--case`, `--fixture`, `--live-task`),
`--runs`, `--model`, `--grader-model`, `--parallel`, `--budget`, `--total-budget` and `--out`
with the frozen values. Always inspect a `--dry-run` first: no selector runs the whole suite.
For **every selected mode**, including eval cases, verify from the trace or invocation record
that the changed target was loaded and exercised in **both arms**. Use direct user invocation
for explicit-only skills; a good answer from the base model without that skill is invalid
evidence. Record which agent/skill and model actually ran;
`--model` on the parent does not by itself override an agent's own model setting. Rebuild
bundled references/metadata in each copy when its source requires it, then run the ordinary
distribution gate. Do not change runner, fixture sources, graders or model settings between
arms to accommodate a candidate.

**Budget limits have a precise scope.** The current runner's `--total-budget` stops launching
new work based on completed agent traces; in-flight work can finish, follow-up calls have
their own per-call limits, and separate LLM-grader costs are not included. It is not a hard
experiment spending ceiling. Report measured agent cost and unmetered grader cost separately.
For a hard ceiling use a host-enforced overall cap; deterministic grading removes unmetered
LLM-grader calls but still requires conservative bounds for all agent/follow-up calls. If a
requested hard ceiling cannot be enforced, do not launch dependent calls; finish preparation
and report the missing enforcement. Never claim missing cost data is zero.

The tuning worker changes only the instruction responsible for the observed training miss;
do not add generic advice, soften gates, or delete correctness-relevant investigation merely
because it was unused on a small sample. Each edit is a new candidate and requires fresh
training evidence. Even a subsequent wording/latency optimization invalidates prior candidate
results. Compare the baseline and candidate per-run JSON/transcripts; the runner's aggregate
score or exit code is not the decision rule (case means can exclude null grader scores).

Select at most one candidate from training. Then the separate evaluator runs **both baseline
and that frozen candidate** on the private holdout, with the predeclared repetitions, once
as the final comparison. Only after selection/evaluation expose the held-out findings. A
holdout failure rejects the candidate and ends this experiment: do not retune on those
findings and rerun the same set as if it were still hidden. A subsequent experiment needs
a newly frozen, independent holdout and fresh limits; it is not an automatic third attempt.

## Adopt or reject, without disturbing user work

Adopt only when the frozen rule passes with complete evidence and an independent diff review
finds no weakened obligations. Apply only the owned candidate patch after checking the target
preimage still matches the baseline. If the user changed it meanwhile, preserve both versions
and reconcile the conflict; changed candidate content requires reevaluation. Rebuild generated
references/metadata and run the checkout's gates after applying. Never use a whole-tree reset
or restore to reject a candidate; leave it unapplied in its isolated copy or reverse only its
owned patch after the same preimage check. Never publish/install from this workflow.

The report records baseline/candidate hashes, target, cases and repetitions, frozen rule,
per-case before/after quality and false positives, required verdicts, missing evidence,
elapsed time and measured/unmetered cost, holdout isolation/exposure, patch disposition, and
artifact paths. Keep rejected experiments too. Verdict: **COMPLETE** for an adopted change
with evidence, **NEEDS WORK** for a rejected or inconclusive candidate, **BLOCKED** when
execution, independent evaluation or required spending enforcement is unavailable. Preparation
or a dry-run alone is never a measured improvement.
