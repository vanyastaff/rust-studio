---
name: resolve-pr
description: "resolve PR feedback, address review comments, fix review threads, watch a PR, shepherd a pull request, watch CI — one-shot: triage and fix review comments with a reply per thread. With --watch: continuously listen for new reviewer/bot comments and CI results, fix failures, and propose CI speedups when checks are slow. Use when a PR has feedback or needs shepherding to merge-ready."
argument-hint: "[PR number or url] [--watch] [--ci-budget=<minutes>]"
user-invocable: true
---

# /resolve-pr — work through PR feedback (one-shot or watch)

Triage review threads honestly: implement what's right, push back with reasoning on what
isn't, leave a clear reply on each. Verification before claims
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`) — no "done" without the change
compiling and tested. Don't perform agreement on wrong feedback; reason it through
(`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`).

`gh` has no push stream — "listening" means streaming CI and new comments through a `Monitor`
(a background poll loop whose stdout lines arrive as events) rather than blocking the session.
Be explicit about that.

## Mode A — one-shot (default)
1. Resolve the PR from `$ARGUMENTS` or the current branch:
   `gh pr view --json number,title,headRefName,reviewDecision`, then fetch unresolved review
   threads (`gh api repos/{owner}/{repo}/pulls/{n}/comments` + `.../reviews`). State the PR and
   open-thread count.
2. Classify each thread: **VALID** (real bug/soundness/test/standards gap → fix) ·
   **PARTIAL** (real concern, better fix → do the better fix, explain) · **REJECT**
   (incorrect/out-of-scope → keep code, draft respectful reply citing the type/test/invariant).
3. Group VALID/PARTIAL fixes into one coherent change. Hand non-trivial edits to
   **`rust-builder`**; spawn **`rust-reviewer`** if broad. In scope only — not a refactor invite.
4. Verify: `cargo clippy --all-targets --all-features -- -D warnings` + `cargo nextest run`
   (or `cargo test`). Cite the result.

## Mode B — watch (`--watch`)
Shepherd the PR toward merge-ready, reacting to both humans and bots. Default CI budget = 10
min unless `--ci-budget=<minutes>` is given.

1. **Snapshot.** Record current open threads and the latest review/comment ids
   (`updated_at`), plus the check-run set (`gh pr checks <n> --json name,state,bucket,link`).
2. **Watch CI (real).** Arm a `Monitor` whose command emits one line per check as it settles
   and exits when the run completes — e.g. a poll loop over `gh pr checks <n> --json name,bucket`
   that emits every non-pending check (cover failures too — `failure`/`cancelled`/`timed_out`,
   not just success) and breaks once nothing is pending. Each line streams back as an event; you
   keep working and react on completion. Don't poll CI by hand while the monitor runs.
3. **Watch comments (stream).** Arm a second `Monitor` that polls `.../pulls/{n}/comments`,
   `.../issues/{n}/comments`, and `.../reviews` with `?since=<snapshot ts>` and emits one line
   per NEW entry. Capture human reviewers **and bots** — clippy/CI annotations, dependabot,
   codecov, coderabbit, etc. For any new actionable item, run Mode A's triage/fix/reply flow on
   just the new threads. (Use `persistent: true` for a session-length watch; stop it with
   `TaskStop` on exit.)
4. **On CI completion.**
   - **Failed:** pull the failing job (`gh run view <run-id> --log-failed`). Route the cause:
     compile/borrow error → `/fix-build`; runtime/logic failure → `/debug`; flaky → `/flaky-hunt`.
     Fix, re-verify locally, push. The push restarts the watch.
   - **Passed:** report green.
5. **Slow-CI → propose speedups.** Read per-job timing (`gh run view <run-id> --json jobs`
   → each job's `startedAt`/`completedAt`). If total wall-time exceeds the CI budget, or one
   job is a clear long pole, spawn **`tooling-lead`** + **`build-engineer`** (and
   **`perf-engineer`** when test/bench time dominates) to propose concrete, Rust-specific
   optimizations against `.github/workflows/`. Candidate levers (prioritize by expected
   wall-time saved, don't dump all of them):
   - `Swatinem/rust-cache` (or sccache) — cache the registry + `target/`; the single biggest win.
   - `cargo-nextest` with `--profile ci` + test **partitioning** across matrix shards.
   - Split monolithic jobs (build / clippy / test / doc / coverage) so they run in parallel.
   - `cargo-hack --each-feature` only on changed crates; skip the full feature matrix on every push.
   - `CARGO_INCREMENTAL=0` in CI (incremental hurts cold caches) + `--locked`.
   - Coverage/`llvm-cov` and miri on a single dedicated job, not every matrix cell.
   - `fail-fast: false` only where you need full signal; otherwise let it short-circuit.
   Output a prioritized list with the estimated saving and the exact workflow edit; offer to
   apply via `/dev-task`.
6. **Pace & exit.** Don't hand-poll between checks — let the `Monitor`s above stream events
   (use a 30s+ poll interval inside each monitor command to respect API rate limits). React as
   events land; otherwise stay idle waiting on a human. (Or the user wraps this skill with
   `/loop`.) Stop the monitors with `TaskStop` before exiting. **Exit when** checks are green AND
   zero open threads AND `reviewDecision` is not `CHANGES_REQUESTED` → announce **MERGE-READY**
   and offer `/pr` to merge. Stop on user interrupt.

## Output
One row per thread, plus a CI line:
```
<file:line>  ✅ FIXED: <change>. — reply: "<text>"
<file:line>  ✏️ BETTER FIX: <what instead>. — reply: "<reasoning>"
<file:line>  ↩️ REJECTED: <why safe/out-of-scope>. — reply: "<pushback>"
CI: <green | red: failing job → routed to /fix-build|/debug | slow: Nm over budget → speedups proposed>
```
End with the clippy/test summary and **COMPLETE** / **NEEDS WORK** (numbered) / **WATCHING**
(monitors armed, what they're waiting on). Don't push, merge, or resolve GitHub threads without
explicit go-ahead.
