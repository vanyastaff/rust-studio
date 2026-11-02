# Performance and size

Use for hot paths, allocations, benchmarks, SIMD and code-size changes. Read
`${CLAUDE_PLUGIN_ROOT}/rules/perf.md` and the performance bar in
`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`.

Classify cold/routine/hot/allocation-sensitive paths. Profile the existing workload before
choosing a change: Criterion for repeatable benchmarks, flamegraph/perf/samply/cachegrind
for CPU/cache behavior, dhat/heaptrack for allocation, hyperfine for subprocesses and
cargo-asm for generated code. Record method, inputs, toolchain and reproduction commands.

## PERF-GATE

- A measured bottleneck identifies the site and cost. Compare alternatives by algorithmic
  complexity, access pattern, ownership and lifecycle; preserve behavior against an oracle.
- Before/after measurements use equivalent workloads, black_box where appropriate and
  disclosed noise/limits. Claimed speedups or allocation reductions have numbers attached.
- Remove unnecessary loop clones/collects/copies after checking data layout and borrowing.
  Short transient collections may fit SmallVec/ArrayVec; measure spill/allocation behavior.
- Static dispatch and dyn dispatch balance hot-call cost against heterogeneity and
  monomorphization size. Inline annotations need measurement; tiny hot inline(always) and
  cold/inline(never) choices also account for instruction-cache and binary-size effects.
- Cross-crate optimization and thin/fat LTO trade-offs are measured end-to-end. Shared locks
  need evidence and a reason they fit better than ownership/channels; check false sharing.
- Unsafe/SIMD changes additionally require `systems.md` and independent SAFETY-GATE evidence.

Use `${CLAUDE_PLUGIN_ROOT}/docs/templates/benchmark-report.md` for method, baseline, result
and reproduction. A proposal without measurements may name a confirmation benchmark but
cannot claim a verified gain.
