---
name: fuzz
description: "fuzz cargo-fuzz libfuzzer crash corpus arbitrary — set up and run coverage-guided fuzzing on parsers, decoders, and unsafe boundaries; triage every crash into a minimized regression test. Use when code consumes untrusted bytes, wraps unsafe, or before a release of an input-handling crate."
argument-hint: "[function/module to fuzz, or empty to pick targets]"
user-invocable: true
---

# /fuzz — coverage-guided fuzzing, crash to regression test

Find the inputs your tests never imagined. Set up `cargo-fuzz`, aim it at the code that
consumes untrusted bytes, run a bounded campaign, and turn every crash into a minimized,
committed regression test. You are the orchestrator: **you do not write fuzz targets or
fixes yourself — you delegate writes to `rust-builder`.** Honor the collaboration
protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

Fuzzing complements the suite, it does not replace it: `/coverage` shows what tests
execute, `/mutants` shows what tests actually check, `/fuzz` finds the inputs nobody
wrote a test for.

## Input

`$ARGUMENTS` may name a function, module, or crate to fuzz, or be empty. If empty,
Phase 1 selects targets. If the named item does not exist, say so and list the nearest
candidates instead of guessing.

## Phase 0 — Preflight

1. Fuzzing needs nightly and `cargo-fuzz`. Check both:
   - `cargo +nightly --version` — if no nightly toolchain, offer `rustup toolchain install nightly`.
   - `cargo fuzz --version` — if missing, offer `cargo install cargo-fuzz`.
2. If the platform cannot run libFuzzer (e.g. no sanitizer support), state it plainly and
   stop with **BLOCKED** — do not degrade into "review the code instead" silently.

## Phase 1 — Pick targets (the highest-leverage 20%)

3. **Recall first:** `/recall fuzzing <area>` — prior target choices, surfaces already
   judged low-value, and known crash history bind this pass; say when a recalled note
   changes the ranking (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
4. Spawn **`rust-scout`** to map candidate fuzz surfaces. Rank by risk:
   - **Untrusted-input parsers/decoders** — anything `fn parse(&[u8]) -> Result<..>`-shaped:
     wire formats, file formats, config, user strings.
   - **`unsafe` boundaries** — code where a bad index/length/layout becomes UB, not a panic.
   - **`serde`/deserialization entry points** with custom `Deserialize` impls.
   - **Stateful APIs with invariants** — fuzz the *sequence of operations*, not one input.
   - Deprioritize: pure business logic on already-validated types, code behind a
     validated boundary, generated code.
5. Present the ranked target list (top 5 max) with one line of why per target. If
   `$ARGUMENTS` named a target, put it first and note anything riskier you found anyway.
6. This is a tactical choice: state which targets you will fuzz (default: top 2) and
   proceed. Use `AskUserQuestion` only if fuzzing requires a real design decision (e.g.
   the API needs a new constructor to be fuzzable at all).

## Phase 2 — Write targets

7. Delegate to **`rust-builder`**: `cargo fuzz init` (once), then one target per surface
   under `fuzz/fuzz_targets/`. Requirements for each target:
   - Prefer **`arbitrary::Arbitrary`** over raw `&[u8]` when the input is structured —
     `fuzz_target!(|input: MyInput| ...)` explores deeper than hand-slicing bytes.
   - The target must assert **properties**, not just "doesn't crash", when cheap ones
     exist: roundtrip (`parse(encode(x)) == x`), no-panic, output invariants. A
     crash-only target still catches UB/panics; a property target catches wrong answers.
   - **No I/O, no globals, no `println!`** in the hot path — targets must be
     deterministic and fast (aim < 1 ms/exec).
   - Seed the corpus: `fuzz/corpus/<target>/` gets a handful of real, valid inputs
     (from tests/ fixtures if they exist). A seeded fuzzer reaches deep states hours
     earlier than an unseeded one.
   - `fuzz/Cargo.toml` must not leak into the workspace: confirm it is excluded
     (`workspace.exclude` or its own `[workspace]` table — `cargo fuzz init` does this;
     verify, don't assume).
8. Evidence: `cargo +nightly fuzz build` compiles clean. Cite the output.

## Phase 3 — Campaign (bounded, not babysat)

9. Run each target with an explicit budget so the session never hangs:
   ```
   cargo +nightly fuzz run <target> -- -max_total_time=300 -timeout=10
   ```
   Default 5 minutes per target; scale up only if the user asked for a deep run. State
   the budget used. Watch coverage feedback in the libFuzzer output (`cov:` line) — a
   target whose coverage plateaus in seconds is probably testing a validated boundary;
   say so rather than banking the time as meaningful.
10. If ASan/libFuzzer reports leaks that are not bugs (e.g. intentional leaks in a
   OnceLock), note them and rerun with `-detect_leaks=0` — but never suppress a
   use-after-free or overflow that way.

## Phase 4 — Triage every crash

11. For each crashing input:
    - **Minimize**: `cargo +nightly fuzz tmin <target> <artifact>` — triage the minimized
      repro, not the raw one.
    - **Classify**: panic (assertion/unwrap/slice index) vs **UB caught by sanitizer**
      (overflow, use-after-free). UB findings go to **`unsafe-auditor`** for a soundness
      judgment; plain panics on malformed input may still be bugs if the API contract
      says "returns Err on bad input".
    - **Root-cause before fixing**: hand the repro to `/debug` discipline — fix the
      cause, not the symptom (clamping the fuzzer's input is not a fix).
12. Delegate each fix to **`rust-builder`**, and require with every fix a **committed
    regression test** that replays the minimized input as a plain `#[test]` (not just a
    corpus file — corpus files don't run in CI by default).
13. Re-run the target against the fixed code until the artifact no longer reproduces.

## Phase 5 — Keep it alive (CI)

14. A fuzzer that ran once is an anecdote. Offer CI wiring — the gate policy is
    `tooling-lead`'s call (BUILD-GATE owner); **`build-engineer`** implements:
    - a CI job running each target for a short budget (e.g. 60 s) per PR touching the
      fuzzed crate, and/or a scheduled nightly long run;
    - corpus committed (small corpora) or cached (large) so runs compound;
    - crash artifacts uploaded on failure.
    For public crates that qualify, mention OSS-Fuzz as the long-run home.

## Phase 6 — Verdict

15. Report:
    - Targets written/run, wall-time per target, final `cov:` count per target.
    - Crashes found → minimized → fixed → regression-tested (all four numbers; they
      should match or the gap must be explained).
    - Anything deprioritized and why.
16. Honesty bar (`${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`): "no crashes in
    5 minutes" is weak evidence, not proof of safety — say what the budget was. Never
    call a surface "fuzzed" if its target plateaued instantly or its corpus was empty.
17. **Persist what settled:** sweep agent verdicts for `MEMORY:` lines and `/remember`
    each; a root-caused crash class, a target judged not-worth-fuzzing and why, or the
    campaign-budget decision is durable — or state "nothing durable"
    (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
18. End with **COMPLETE / NEEDS WORK (numbered blockers) / BLOCKED**. Suggest
    `/audit-unsafe` if fuzzing exposed UB, `/security-audit` if the surface is
    attacker-facing, `/mutants` to grade the rest of the suite.

## Error recovery

If a build fails inside `fuzz/` (sanitizer/linker issues are common), hand the exact
error to **`rust-build-resolver`** — do not delete the target to get green. If a crash
cannot be minimized (flaky repro), record the raw artifact path and mark the finding
DEFERRED with the reason; never discard a crashing input.
