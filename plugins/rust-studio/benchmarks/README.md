# Rust Studio benchmarks

These fixtures evaluate the studio's procedures and role/profile assignments. Run them through
`/maintain-studio --mode evaluate` or `bun tools/eval-runner.ts` from the plugin root.
Model-backed runs consume provider budget only when explicitly requested.

## Fixture layout

`fixtures/<domain>/<case>/` contains supplied source and a private `ground-truth.md`.
The runner copies the source without the oracle, assigns a fresh read-only role with the
required domain profile, then scores against the private oracle. The authoritative folder to
role/profile mapping lives in `tools/eval-runner.ts`; no second persona roster is maintained here.
Scouting uses researcher/navigation; code and design inspection use reviewer/domain profiles.

The oracle distinguishes defect recall, maintainer-shape rejection and source-map recall.
A fixture's calibrated prompt and verdict class are preserved when catalog names change.
Do not weaken the oracle or replace missing output with a pass. Keep failed launches, partial
coverage, model identity, cost and unavailable tools visible in result artifacts.

## Live tasks

`live/<name>/task.md` declares a skill or agent target, optional mode/profile, limits and the
request. `crate/` supplies a disposable baseline; `check.sh` is the private behavior checker.
Implementation tasks use the implementer role or implement-change entry. The runner records
actual command outcomes; green bookkeeping is not behavioral evidence.

`live/cold-handoff/` additionally runs a design-only author and a separate implementation
conversation. Only the unchanged baseline and declared artifacts cross. Its observer records
behavior and lifecycle evidence separately: missing or opaque traces cannot prove fresh
reconstruction, coordinator acceptance and CURRENT before the first product write.
See [the cold-handoff contract](live/cold-handoff/README.md).

Examples:

```text
bun tools/eval-runner.ts --fixture api/leaky-surface --budget 4
bun tools/eval-runner.ts --live-task cold-handoff --dry-run
bun tools/eval-runner.ts --coverage
```

An actual live run also needs authenticated host access and the fixture's toolchain. A dry run,
simulated runner unit test or renamed target does not constitute a new agent-quality result.

## Adding or changing a fixture

Preserve a real failure mode, an independently observable outcome and a private oracle.
Select the execution role from the action, then require its domain profile. Profile names
supply knowledge, not write permission. Extend the runner mapping and reference coverage
when adding a domain. Keep golden source behavior and expected verdicts stable during renames.
Use held-out cases for prompt changes and report regressions as well as improvements.

Historical measurements remain in [the benchmark notes](../docs/benchmarks.md) and saved result
artifacts with their original identities. Current catalog counts are not historical coverage
or accuracy claims. Re-run representative cases after changing behavior and preserve every
unexecuted provider/host combination as unverified.
