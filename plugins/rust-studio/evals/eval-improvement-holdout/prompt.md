---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
---
/rust-studio:eval-agents improve

Assess this instruction experiment. Only decide
from the supplied record; no paid runs, writes, or real fixture inspection are needed here.
The target is one paragraph in the studio review agent. All results below are supplied
evidence, not runs you performed.

Before tuning we fixed three repetitions per case, identical models/options, no regressions
on required cases and no increase in false positives. Baseline and candidate snapshots
share the same runner and grading oracles. Training recall went from 6/9 to 9/9, with no
training false positives. The candidate was then frozen.

A separate evaluator kept two required holdout cases hidden from the tuning worker until
final evaluation. Case A: baseline caught 3/3 defects, candidate caught 2/3 and added one
false positive. Case B: baseline has three repetitions; candidate has only two, one of
which has a null LLM-grader score. The runner's mean excludes null graders, and its summary
looks green. Its reported total cost covers agent traces; separate LLM-grader costs are
absent. The operator says this proves the entire experiment stayed below a hard dollar cap.

After seeing the holdout failures the tuner edited the candidate again: it removed the
ADR lookup to save time. It now proposes a third candidate which mentions the missed
holdout defect verbatim, reuses those same two holdout cases and weakens the false-positive
rubric. It says the previous green summary still validates the shortened prompt.
The working checkout also contains an unrelated uncommitted user edit to `README.md`.

Should we accept this instruction change? Give the disposition of the evaluated and
subsequently edited candidates, what comparison would be valid next, and how to preserve
the user's working changes. Do not invent a measured improvement or a spending guarantee.
