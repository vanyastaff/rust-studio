<!-- rust-studio template: copy this file into your project and fill in the blanks -->

# Benchmark: <what>

*Name the specific function, algorithm, or subsystem under measurement. Be specific enough that the report is unambiguous six months from now (e.g. "HashMap vs BTreeMap lookup — 10k-entry cold cache").*

## Setup

- **Machine:** *CPU model, core count, RAM, OS, e.g. "AMD Ryzen 9 7950X, 32-core, 64 GB DDR5, Linux 6.8 x86_64"*
- **rustc version:** *Output of `rustc --version --verbose`, including host and commit hash*
- **Cargo profile:** *`release` / `bench`; paste relevant `[profile.bench]` overrides from Cargo.toml if non-default*
- **RUSTFLAGS:** *e.g. `RUSTFLAGS="-C target-cpu=native"` or "none"*
- **Criterion config:** *Sample count, measurement time, warm-up time — paste the `Criterion::default()` builder chain or `criterion.toml` snippet*
- **Noise mitigation:** *CPU governor set to `performance`? Turbo disabled? Other isolation steps taken?*

## Workload

- **Inputs:** *Describe each benchmark group input — data type, generation method (random seed, fixed corpus, synthetic), e.g. "Vec<u64> filled with `rand::thread_rng()`, seed 42"*
- **Sizes:** *List the parameter sweep, e.g. "n ∈ {100, 1 000, 10 000, 100 000}"*
- **black_box usage:** *Confirm that outputs and inputs are wrapped in `std::hint::black_box` to prevent dead-code elimination; note any intentional exceptions*
- **Excluded paths:** *Any code paths deliberately not benchmarked and why*

## Results

*Paste criterion output or summarize below. `baseline` = before the change; `change` = after.*

| Case | Baseline mean ± σ | Change mean ± σ | Delta % | Significant? |
|------|------------------|-----------------|---------|--------------|
| *e.g. lookup/1000* | *e.g. 1.23 µs ± 8 ns* | *e.g. 0.98 µs ± 6 ns* | *e.g. −20.3 %* | *Yes (p < 0.05)* |
| | | | | |
| | | | | |

*Attach or link the full `target/criterion/` HTML report if available.*

## Profile Notes

- **Flamegraph:** *Link or embed; describe the dominant hot path (function name + % self time), e.g. "65% of cycles in `hashbrown::map::find_insert_slot`"*
- **perf / DHAT / heaptrack observations:** *Cache miss rate, branch misprediction count, allocation hot spots — whatever tools were run*
- **Unexpected callers:** *Anything surprising that showed up in the profile that is worth a follow-up*

## Interpretation

*Explain why the numbers changed. Reference specific code changes (commit SHA or PR), data-structure choices, algorithmic complexity shifts, or hardware effects (SIMD, branch predictor, cache line alignment). One to three paragraphs.*

## Decision

- [ ] **Ship** — improvement is real, regression-free, ready to merge
- [ ] **Revert** — regression outweighs benefit; link to revert PR
- [ ] **Iterate** — describe what to try next and who owns it

*Briefly justify the choice and record any follow-up issue numbers.*
