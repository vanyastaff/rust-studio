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
- `Vec` has no small-buffer optimization — every `push` may heap-allocate and the struct
  itself holds only a `ptr`/`len`/`cap`. When inline storage matters for small collections,
  reach for `smallvec`/`arrayvec` (stack until they spill), not a bare `Vec`.
- No needless `.clone()` / `.to_vec()` / `.collect()` in loops; prefer borrowing and
  lazy iterators. `Cow` where ownership is conditional (borrow the common case, own only
  when you must mutate).
- Prefer `&str`/`&[u8]` slices over owned copies; `bytes::Bytes` for cheap-clone,
  reference-counted buffers shared across tasks/owners.

## Algorithms & data
- Justify complexity: pick the data structure for the access pattern (`HashMap` vs
  `BTreeMap` vs sorted `Vec`). Avoid accidental O(n²) (e.g. `contains` in a loop).
- Batch syscalls/I/O; amortize.
- SIMD/`unsafe` micro-opts require a benchmark proving the win and a `// SAFETY:` note;
  loop over `unsafe` only after the safe version is the proven bottleneck.

## Inline & dispatch
- `#[inline]` is a cross-crate hint — without it the compiler will not inline a function
  into a downstream crate. Add it only where a measurement shows the cross-crate call is hot.
- `#[inline(always)]` only for tiny, genuinely hot functions; `#[inline(never)]` / `#[cold]`
  on error paths and rarely-taken branches to keep them out of the hot instruction stream.
- Do NOT annotate everything — over-inlining inflates compile time and binary size for no
  measured gain. Annotate where you proved it helps, nowhere else.
- Static dispatch (`impl Trait`, generic parameters) is zero-cost; prefer it on hot paths.
  `dyn` dispatch is not zero-cost but is often the right trade for compile time / binary size
  when the call is not hot or strategies are stored heterogeneously — choose deliberately,
  don't reach for `dyn` by reflex or monomorphize a cold trait into bloat.

## Build profile & crate boundaries
- Cross-crate LTO is off by default. When a project is split into many crates, set
  `lto = "thin"` in the release profile so the optimizer can inline and devirtualize across
  crate boundaries (full `lto = true` costs more build time for marginal extra gain).
- Splitting into focused crates buys compile parallelism and selectable features, but pay
  for it knowingly: version skew (duplicate incompatible deps) and no cross-crate LTO until
  you enable it. Don't shard a hot path across crate boundaries and then wonder where the
  inlining went.

## Don't pessimize elsewhere
- A perf change must not regress readability without a measured, documented payoff.
- Re-run the full bench suite after the change; attach numbers to the PR.
