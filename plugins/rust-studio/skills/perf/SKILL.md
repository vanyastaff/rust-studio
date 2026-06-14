---
name: perf
description: "perf profile benchmark optimize flamegraph criterion hot-path — measure first, optimize second: profile to find the real bottleneck, benchmark it with criterion, optimize, then prove the win with before/after numbers. Use for any performance work."
argument-hint: "[target / workload to optimize]"
user-invocable: true
---

# /perf — profile, bench, optimize, prove

Performance work, end to end, with `perf-engineer`. **No change lands without numbers**
(`${CLAUDE_PLUGIN_ROOT}/rules/perf.md`, `${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`).

## Phase 1 — Find the real bottleneck (profile)
- Establish a representative workload. Spawn `perf-engineer` to **profile** it —
  `cargo flamegraph`, `samply`, or `perf` — and identify where time/allocations actually go.
  Optimize the **measured** hot path, never a guessed one.

## Phase 2 — Benchmark the hot path (baseline)
- Ensure a `criterion` bench exists for that path (scaffold one under `benches/` if not;
  delegate the write to `rust-builder`). Use `black_box` on inputs and outputs. Capture the
  **baseline** numbers (mean ± variance). `hyperfine` for end-to-end CLI timings.

## Phase 3 — Optimize (decide tactical)
- Propose the change with a predicted win (reduce allocations/clones, better data structure,
  `SmallVec`/`Cow`, SIMD, fewer syscalls). Decide tactical optimizations yourself; surface a
  fork only if it trades safety or readability for speed. Any new `unsafe` → `unsafe-auditor`.

## Phase 4 — Prove it (re-measure)
- Re-run the bench; show **before/after** side by side (criterion saved baselines). Re-profile
  to confirm the hot path moved. Record results in
  `${CLAUDE_PLUGIN_ROOT}/docs/templates/benchmark-report.md`.

## Output
The bottleneck found, the change, and before/after numbers (verbatim, not summarized). Verdict
**COMPLETE / NEEDS WORK / BLOCKED**. A perf change that doesn't beat the baseline is reverted.
Hand off to `/review` (or `/team-perf` for a full systems+safety hardening pass).
