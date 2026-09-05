---
name: perf
description: "Use when profiling and optimizing Rust performance with flamegraphs, Criterion, and before/after measurements."
---

# /perf — profile, bench, optimize, prove

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Performance work, end to end, with `perf-engineer`. **No change lands without numbers**
(`references/perf.md`, `references/working-preferences.md`).

## Phase 0 — What can run here?
Measurement needs a crate that builds and a shell that runs. When the hot path arrives as
**pasted code with no project**, or the first `cargo`/`Bash`/`Write` call is **refused**, that
is a fact about the host — say it once, do **not** scaffold a crate, a `benches/` directory, or
a Criterion harness to measure pasted code, and do not retry the command under another
spelling (`references/sub-agents.md`, refused tools). Fall through to the reading pass instead:
walk the code against `references/perf.md` — per-iteration `format!`/`to_string`/`collect`,
`Vec::new()` where `with_capacity` is knowable, `split(..).collect::<Vec<_>>().join(..)`
chains, clones that a borrow would serve, a fresh buffer per call where one can be reused —
and report every allocation site with its line, the fix, and the measurement you would run
once a crate exists. Then the verdict. A measurement plan is the deliverable when measuring is
impossible; sixteen turns of scaffolding with no verdict is the failure this phase prevents.

## Phase 1 — Find the real bottleneck (profile)
- **Recall first:** `/recall <target>` (or reuse the session-start memory index if it already
  surfaced this area) — known hot paths and past optimization attempts (including rejected ones)
  bind this pass; say when a recalled note changes the approach. If nothing surfaces, proceed
  (`references/memory-protocol.md`).
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
  to confirm the hot path moved. Record results in `docs/benchmark-report.md` in the project,
  using `references/templates/benchmark-report.md` as the template.

## Output
The bottleneck found, the change, and before/after numbers (verbatim, not summarized). Verdict
**COMPLETE / NEEDS WORK / BLOCKED**. A perf change that doesn't beat the baseline is reverted.
**Persist what settled:** a proven win + why (and any rejected attempt) is durable — sweep agent
verdicts for `MEMORY:` lines and `/remember` each (it dedups); `/remember` the win too — or state
"nothing durable" (`references/memory-protocol.md`).
Hand off to `/review` (or `/team-perf` for a full systems+safety hardening pass); if the
concern is artifact size rather than speed, that's `/bloat`.
