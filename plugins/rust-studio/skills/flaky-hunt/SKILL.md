---
name: flaky-hunt
description: "flaky test hunt fix nondeterministic — reproduce, diagnose, fix or quarantine a flaky test. Use for any intermittent/nondeterministic test failure."
argument-hint: "[optional test filter]"
user-invocable: true
---

# /flaky-hunt — hunt and fix flaky tests

Drive a systematic campaign against nondeterministic test failures through
**reproduce → diagnose → fix → quarantine**, honoring the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You are the orchestrator:
**you do not write code or tests yourself — you delegate all writes to `rust-builder`.**
Gate with `AskUserQuestion` only at phase boundaries and genuine forks — decide
tactical calls yourself, state choice + one-line rationale.

## Input

`$ARGUMENTS` is an optional test filter (e.g. `my_module::my_test`, a path, or a
`#[test]` name). If empty, hunt across the whole suite. If the scope looks ambiguous,
restate the target and confirm with the user before proceeding.

## Phase 1 — Reproduce

1. Spawn **`rust-scout`** to locate the test(s) and any setup/teardown fixtures that
   might be implicated. Scout uses serena MCP (`find_symbol`, `find_referencing_symbols`,
   `search_for_pattern`) for symbol-level navigation and `rg` for macro-generated or
   `cfg`-gated sites. Record `file:line` for each candidate.
2. Run the suite in stress mode — no retries, randomized order — to surface failures:
   ```
   cargo nextest run --retries 0 --test-threads 8 [filter]
   ```
   Run at least **5 consecutive passes or until a failure is observed**.
3. For tests using `proptest` or `quickcheck`, vary seeds explicitly:
   ```
   PROPTEST_CASES=500 cargo nextest run [filter]
   ```
4. Record: failure rate, error message, stack trace, and any seed printed.
   If the test never fails within 10 runs, `AskUserQuestion`: report the failure rate and
   ask whether to stop or continue with a higher iteration count (CI-only or load-sensitive
   flakiness is common; the user's call is load-bearing).

## Phase 2 — Diagnose

5. Spawn **`test-engineer`** with the reproduction evidence. Its job is to identify
   the nondeterminism source. Common classes (check in order):

   | Class | Signals |
   |---|---|
   | **Clock / time** | `SystemTime::now()`, `Instant`, `tokio::time::sleep`, timeouts |
   | **Port / socket binding** | hardcoded ports, `TcpListener::bind("0.0.0.0:8080")` |
   | **Shared / global state** | `static`, `once_cell`, `lazy_static`, thread-locals |
   | **Ordering / HashMap** | `HashMap` iteration, unsorted `collect()`, non-deterministic spawns |
   | **External I/O** | filesystem paths, env vars, network calls, temp dirs |
   | **Proptest seed** | reproducible only when seed is pinned |

6. `test-engineer` emits a diagnosis: the nondeterminism class, the exact
   expression(s) responsible, and a confidence level (HIGH / MEDIUM / LOW).
   If confidence is LOW, `AskUserQuestion`: share the hypothesis and ask whether to
   proceed with the proposed fix or investigate further — a LOW-confidence fix that
   fails to eliminate the flakiness wastes a full verify cycle.

## Phase 3 — Options & Decision (gate)

7. Present **2–4 fix strategies** with trade-offs and a recommended default.
   Typical patterns:
   - **Inject a fake clock** — pass a `Clock` trait / `tokio::time::pause()` instead of
     reading `SystemTime`/`Instant` directly.
   - **Ephemeral port** — bind to port `0` and let the OS assign; read it back.
   - **Isolated state** — remove the shared `static`; pass state as a parameter or use a
     per-test fixture.
   - **Deterministic ordering** — sort before asserting; use `BTreeMap` in tests.
   - **Proper tempdir** — replace hard-coded paths with `tempfile::TempDir`.
   - **Pin proptest seed** — add `#[proptest(cases = 256)]` and record the failing seed as
     a regression case.
8. `AskUserQuestion`: show the diagnosis, the options, and the recommended fix; get
   explicit approval before any code is written. Reference
   `${CLAUDE_PLUGIN_ROOT}/rules/testing.md` for studio testing standards.

## Phase 4 — Fix

9. Spawn **`rust-builder`** with the approved fix plan. Instruct it to:
   - apply the minimum change that eliminates the nondeterminism,
   - add or update the test to assert deterministic behavior (e.g. assert the injected
     clock value, assert sorted output),
   - run `cargo nextest run --retries 0 [filter]` for **10 passes** and paste the summary
     as evidence,
   - run `cargo clippy --all-targets --all-features -- -D warnings` and `cargo fmt`, fix
     any new warnings,
   - stay strictly in scope — no opportunistic cleanups.
10. Show the diff summary and command output to the user.

## Phase 5 — Verify (gate)

11. Re-run the stress pass post-fix:
    ```
    cargo nextest run --retries 0 --test-threads 8 [filter]
    ```
    10 consecutive clean runs = COMPLETE. Fewer = NEEDS WORK; loop Phase 4.
12. Spawn **`rust-reviewer`** on the diff to confirm the fix is correct and doesn't
    introduce new issues. Also spawn **`qa-lead`** to clear the **QA-GATE** (no new
    flakiness introduced; coverage not regressed).

## Phase 6 — Quarantine (if not fixable)

If the fix is blocked (e.g. requires upstream change, wide refactor, or design decision),
quarantine the test rather than leaving it silently broken:

13. `AskUserQuestion`: confirm the quarantine plan — this is an intentional deferral that
    should be tracked, not an automatic fallback.
14. Delegate to **`rust-builder`** to add `#[ignore = "<issue-url>: <reason>"]` to the
    test and emit a `// TODO(flaky):` comment with the diagnosis.
15. Instruct **`rust-builder`** to open (or draft) a tracking issue with:
    - reproduction steps and failure rate,
    - diagnosis class and confidence,
    - proposed fix (blocked by X).

## Phase 7 — Verdict

16. Summarize: tests hunted, root cause found, fix applied (or quarantine applied),
    evidence (nextest output, clippy output), gates passed.
    End with **COMPLETE / NEEDS WORK / BLOCKED**.
17. Suggest next steps: `/review` to audit the full diff, `/dev-task` if the fix requires
    a larger refactor (e.g. introducing a `Clock` abstraction across many callers), or
    `/perf` if the isolation change touches hot paths.

## Error recovery

If any sub-agent returns **BLOCKED**: surface it immediately, do not proceed, and
`AskUserQuestion` with options — (a) quarantine the test and track with an issue,
(b) retry with a narrower scope, (c) escalate to `/dev-task` for the prerequisite
refactor. Never discard completed reproduction evidence.
