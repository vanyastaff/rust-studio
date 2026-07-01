---
name: mutants
description: "mutants mutation testing cargo-mutants missed caught test strength — grade the test suite by mutating the code and seeing what the tests miss, then close the real gaps. Use when coverage looks fine but you don't trust the tests, before relying on a suite for a refactor, or to gate critical modules."
argument-hint: "[optional package or path]"
user-invocable: true
---

# /mutants — prove the tests actually check something

Coverage says a line *ran*; mutation testing says a bug on that line would be *caught*.
Run `cargo-mutants`, treat every missed mutant as a concrete "this bug would ship"
finding, and close the ones that matter with targeted assertions. You are the
orchestrator: **you do not write tests yourself — you delegate writes to
`rust-builder`.** Honor the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

Sibling skills: `/coverage` finds code no test executes; `/mutants` finds code tests
execute but don't check; `/fuzz` finds inputs nobody wrote a test for.

## Input

`$ARGUMENTS` may be a package (`-p my-crate`), a path filter (`-f src/parser.rs`), or
empty. Mutation testing is expensive (it rebuilds and retests per mutant) — for a
workspace with more than a handful of crates, default to the crate(s) with the highest
behavioral risk (parsers, money/time math, state machines, anything feeding `unsafe`)
and **say which scope you chose**; do not silently mutate the world.

## Phase 0 — Preflight

1. `cargo mutants --version` — if missing, offer `cargo install cargo-mutants`.
2. The suite must be green and reasonably fast first: run the project's test runner
   (honor the configured `test_runner`; nextest via `cargo mutants --test-tool=nextest`).
   A red or flaky suite makes every mutant result garbage — if the baseline fails, stop
   and route to `/fix-build` or `/flaky-hunt` first.
3. Estimate cost: `cargo mutants --list [scope]` prints the mutant count without running.
   Report the count and the rough wall-time (count × test-suite time / parallelism). If
   it is large, narrow scope (`-f`) or shard (`--shard k/n`) — state the choice.

## Phase 1 — Run

4. Run with an explicit budget and the scope from Phase 0:
   ```
   cargo mutants [-p <pkg>] [-f <path>] --test-tool=nextest --timeout-multiplier 1.5 --jobs <N>
   ```
   Read-only per protocol §1; no approval needed. Results land in `mutants.out/`
   (ensure it is gitignored; add it if not).
5. Classify the outcome table:
   - **missed** — the mutant compiled, tests passed → a bug the suite would ship. The
     only category that matters.
   - **caught** / **timeout** — fine.
   - **unviable** — didn't compile; noise, ignore.

## Phase 2 — Triage (most missed mutants are not equal)

6. **Recall first:** `/recall mutation testing <scope>` — previously accepted misses
   (owned risks) must not be re-litigated every run; say when a recalled note changes
   the triage (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
7. Rank missed mutants by behavioral risk, not by count:
   - **High**: mutations in error handling (`Ok`↔`Err` swaps, deleted `?`), boundary
     arithmetic (`<`↔`<=`, `+`↔`-`), match-arm deletions in state machines, anything in
     code that feeds `unsafe` or money/time/auth logic.
   - **Low / acceptable**: mutations in `Display`/`Debug`/log formatting, cache
     heuristics where any value is *correct-but-slower*, cosmetic defaults.
8. Present one line per finding, severity-tagged, top 10 max:
   ```
   path:line  🔴 MISSED: <mutation> survives — <the bug that would ship>.
   path:line  🟡 MISSED (low risk): <mutation> — <why it's tolerable if skipped>.
   ```
   A missed mutant is a fact about the tests, not an accusation against the code —
   the fix is almost always a **sharper assertion**, not new code.

## Phase 3 — Consult qa-lead

9. Spawn **`qa-lead`** with the ranked list and `mutants.out` summary. Instruct it to:
   - confirm which misses represent real behavioral risk vs. acceptable noise,
   - for each real one, draft the *minimal* test or assertion upgrade that kills it
     (often: replace `assert!(r.is_ok())` with a value check; add the boundary case;
     assert the error variant, not just `is_err`),
   - flag any miss that indicates **dead code** rather than a weak test — deleting code
     is a better fix than testing it.

## Phase 4 — Close the gaps

10. For each approved fix, delegate to **`rust-builder`** with the exact mutant (file,
   line, mutation) and the drafted assertion. Require it to verify the kill by re-running
   the narrowed scope and matching the specific mutation by name:
   ```
   cargo mutants -f <file> --re '<mutation text from the missed list>'
   ```
   The mutant flipping from missed → caught (check `mutants.out/caught.txt`) is the
   acceptance criterion — a new test that passes but still misses the mutant is not done.
11. Low-risk misses the user owns: record them (path:line + reason) in the summary so
    the decision is visible, not silent.

## Phase 5 — Verdict

12. Report:
    - Mutants: total / caught / missed before → missed after, and the mutation score
      (killed ÷ viable, where killed = caught + timeout — a hang IS detection)
      before/after for the chosen scope.
    - Findings closed vs. explicitly accepted (with reasons).
    - Evidence: paste the final `cargo mutants` summary line.
13. Honesty bar (`${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`): report the
    score **for the scope actually mutated** — a 95% score on one file is not "95%
    mutation coverage". Do not chase 100%: killing formatting-mutants is vanity;
    killing error-path mutants is the job.
14. End with **COMPLETE / NEEDS WORK (numbered blockers) / BLOCKED**. Suggest
    `/coverage` if misses clustered in never-executed code, `/fuzz` for
    untrusted-input surfaces, `/tech-debt` if triage exposed dead code. For CI, suggest
    an incremental gate — `git diff origin/main.. > pr.diff && cargo mutants --in-diff
    pr.diff` — rather than a full-run gate (full runs are too slow to block PRs); the
    gate is `tooling-lead`'s policy call (BUILD-GATE owner), `build-engineer` implements.

## Error recovery

If `cargo mutants` fails on workspace quirks (build scripts writing outside OUT_DIR,
tests needing env/DB): exclude the offending crate's files by glob
(`--exclude 'crates/<name>/**'` — `--exclude` filters source files, not packages) or fix
the test's isolation via **`rust-builder`** — never fake a score from a partial run without
labeling exactly what was excluded. If a run is interrupted, `mutants.out` keeps
completed results; resume with the remaining scope instead of restarting from zero.
