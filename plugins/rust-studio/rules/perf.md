---
name: perf
paths: "**/benches/**"
description: Performance and benchmarking standards
---

# Performance Standards

Applies to benchmarks and performance-critical paths.

## Measure, don't guess
- No performance claim without a `criterion` benchmark showing before/after.
- Benchmark realistic inputs and sizes; use `black_box` on inputs and outputs to
  defeat the optimizer. Report variance, not just the mean.
- Profile (flamegraph / `perf` / `samply`) to find the hot path before optimizing it.
  Optimize the measured bottleneck, not the guessed one.

## Allocation & copies
- Hot paths avoid per-iteration allocation: reuse buffers, `Vec::with_capacity`,
  `SmallVec`/`arrayvec` for small bounded collections, `&mut` scratch space.
- No needless `.clone()` / `.to_vec()` / `.collect()` in loops; prefer borrowing and
  lazy iterators. `Cow` where ownership is conditional.
- Prefer `&str`/`&[u8]` slices over owned copies; `bytes::Bytes` for cheap-clone buffers.

## Algorithms & data
- Justify complexity: pick the data structure for the access pattern (`HashMap` vs
  `BTreeMap` vs sorted `Vec`). Avoid accidental O(n²) (e.g. `contains` in a loop).
- Batch syscalls/I/O; amortize. Consider `#[inline]` only where measured to help.
- SIMD/`unsafe` micro-opts require a benchmark proving the win and a `// SAFETY:` note;
  loop over `unsafe` only after the safe version is the proven bottleneck.

## Don't pessimize elsewhere
- A perf change must not regress readability without a measured, documented payoff.
- Re-run the full bench suite after the change; attach numbers to the PR.
