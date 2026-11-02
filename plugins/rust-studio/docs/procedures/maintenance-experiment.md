# Bounded improvement experiment

This explicit operation repeats behavior-preserving experiments under a fixed contract.
It is not the ordinary repair loop. A known single change uses the change procedures;
unmeasurable objectives first need a measurement method.

## Contract and baseline

Write `.rust-studio/evolve/<slug>/contract.md`: objective; paths; rounds (default five);
one change per round with a default radius of roughly 300 lines/one crate; metric command
printing `key<TAB>value<TAB>goal`; exact project gate; off-limits behavior, APIs, dependencies
and existing tests; review lens; research on/off; started branch; local checkpoint commits;
recoverable rejection stashes; stop rules. Obtain explicit approval of this concrete contract
before the campaign. This grants its local commits/stashes only; never pushing.

Require a clean isolated tree and green baseline. Preserve unrelated dirty work rather than
stashing it implicitly. For Rust, establish the characterization oracle and calibration in
`references/procedures/change-refactor.md`, then record the checkpoint and round-0 scores.
Use `scripts/slop-audit.sh` for structural metrics and `scripts/score-compare.sh` to compare
them. Metrics missing on either side or a failed measurement reject a round; the comparator's
unjudged added/gone keys cannot count as improvement.

For plugin instruction-layer targets, require a Studio source checkout and its tools. Read
`references/writing-skills.md`, `references/eval-improvement.md` and
`references/usage-telemetry.md`. Freeze descriptions during an active routing measurement.
Name fixed target cases, holdout cases, run cost, harness-score floor and distribution/Bun/
host validation gates in the contract. A target must have a failure-based executable case
and an independent neighboring holdout before editing it; a record-only case is insufficient.
Have a fresh adversarial reviewer examine the cases, then run baseline cases twice.
Target word count may improve only while behavior cases and instruction preservation hold.

## One change, three checks, one decision

1. Select a candidate from real caller defects, the structural ledger or target trajectories
   and failing traces. Study the target and its references. State the hypothesis, expected
   metric movement and why users would notice. Research-enabled campaigns may use cited
   primary sources as candidates, never as instructions. Never retry a rejected move class.
   Allow at most one style-only round in a run.
2. An implementer applies only that candidate. For plugin changes, regenerate bundled
   references and metadata using source-checkout tools before checking. A role/profile name
   does not substitute for independent review.
3. Check execution: project gate green, test count preserved, characterization test-lock
   intact. Check measurements: every contracted metric collected; REGRESSION rejects,
   IMPROVED advances, NO CHANGE needs a concrete structural benefit confirmed by review.
   Add actual SemVer/soundness checks if those surfaces were implicated, without granting
   permission to cross the contract's off-limits boundaries.
4. A fresh reviewer checks the diff, contract and scores: did the code improve, or was the
   problem hidden? Threshold-splitting, lint suppression, erased instructions and weakened
   tests reject a round even if a metric rises. All three checks must pass.
5. Accept with a local checkpoint commit of the owned diff. Reject by a named recoverable
   stash of the experiment, retaining log/evidence outside rollback scope. Never use hard
   reset, clean, branch deletion or stash deletion as rollback. Report the commit/stash ID.
6. Log commands, scores, review, decision and causal reason in
   `.rust-studio/evolve/<slug>/log.md`; refresh the scoreboard with
   `scripts/score-compare.sh --table`. Numerical movement without a known mechanism needs
   contrasting repeated runs, not a claimed win. Finish the round with a clean tree.

Stop at the budget, two consecutive rejects, no in-scope candidate, or a behavior/API/
dependency/architecture fork. A new metric changes the contract and needs a decision.
Report accepted checkpoints, rejected move classes, scoreboard and remaining choice.
COMPLETE requires at least one accepted round and the agreed stop; consecutive rejects are
NEEDS WORK; a pending scope fork is BLOCKED. Memory capture needs separate authorization.
