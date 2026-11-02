# Measure runtime or artifact size

Load `references/profiles/performance.md` and `references/perf.md`; add systems/platforms
profiles for unsafe, embedded or WASM work. A measurement request authorizes measurements,
not source optimization. An optimization request follows the delivery procedure for writes.

## Establish a comparable baseline

Record target, toolchain, release profile, feature set, workload, environment and any budget.
Reuse relevant prior results only after checking their conditions. If no buildable project
exists, or a required tool is refused, report that limitation once and perform a reading pass:
allocation sites, clones, collection chains, buffering and probable costs with file/line and
the exact measurement that could decide them. Do not scaffold a project merely to benchmark
pasted code. An unmeasured proposal cannot establish a performance win.

| Operation | Baseline and attribution | Required comparison |
|---|---|---|
| `performance` | Profile representative work with flamegraph, samply or perf; benchmark the measured hot path with Criterion/black_box or CLI hyperfine | Before/after with variance, same workload, then re-profile |
| `size` | Build what ships; record raw bytes plus WASM optimized/gzipped bytes or embedded flash size; attribute with cargo bloat by function/crate and llvm-lines, or twiggy/symbol maps | Same target/profile/strip state, per-step bytes, percentage and distance to budget |

For performance, an authorized implementer may add a missing representative benchmark in
the existing project. Record numbers in `references/templates/benchmark-report.md`'s report
shape. For size, report release settings before changing them: strip, LTO, codegen units,
panic strategy and opt-level. Settings carry speed, build-time and unwind trade-offs;
`panic = "abort"` and dropping visible functionality require an explicit scope decision.

## Change one measured cause at a time

Rank candidates by evidence, expected saving and risk. Size attribution distinguishes unused
dependency weight, default features, generic monomorphization, macro expansion, formatting
machinery, symbols and unwind tables. Runtime attribution identifies the actual hot path
and allocation/syscall mechanism. Profile changes, feature selection, internal code and
API changes have different risk; none bypasses explicit-only dependency operations.

Use an implementer with the relevant profiles. Remeasure each logical change and preserve
behavior tests. Revert only this task's unsuccessful experiment when it fails to beat its
baseline; preserve unrelated edits. Any new unsafe requires an independent systems review
and SAFETY-GATE. Public API changes require API-GATE and the user's scope authorization.
For dependency removals/swaps, compare `cargo tree -i <crate>` and binary attribution:
feature unification can keep code in the artifact after a direct dependency disappears.

Finish with baseline, per-step and final measurements, variance where meaningful, target
conditions, actual test/gate results and explicit limitations. Coarse symbol-map attribution
is labeled coarse. A strip-only saving is reported as such. Optional CI budgets are a
separate tooling-policy decision; they are not silently installed. COMPLETE means the
requested measurement or improvement is proved, not that an unmeasured proposal sounds faster.
