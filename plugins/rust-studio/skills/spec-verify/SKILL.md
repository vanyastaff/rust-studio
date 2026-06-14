---
name: spec-verify
description: "spec verify archive — prove a Rust implementation meets its spec's acceptance criteria; runs tests, clippy, fmt, and gates, then archives the spec on pass. Use when all tasks for a spec are done."
argument-hint: "[spec slug or path]"
user-invocable: true
---

# /spec-verify — verify against the spec (verify → archive)

Prove the work meets `.rust-studio/specs/<slug>/spec.md`. Evidence over assertion
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`, §7). You are the orchestrator:
**delegate writes (the verify report) to `rust-builder`**; do not write files directly.

## Steps
1. Read the spec's **acceptance criteria** (`$ARGUMENTS` = slug or path).
2. For each criterion, find and run the evidence:
   - Use serena MCP (`find_symbol`, `search_for_pattern`) to locate test functions and
     impl sites relevant to each criterion — never Bash `grep` for symbols.
   - `cargo nextest run` (fall back to `cargo test`), including `--doc` for doc-tests —
     map test names to criteria in the report.
   - `cargo clippy --all-targets --all-features -- -D warnings` and `cargo fmt --check`.
   - `cargo +nightly miri test` if `unsafe` was involved; criterion benches if perf was
     a criterion.
3. Spawn the relevant **gate owners** in parallel (QA-GATE always; add API/ASYNC/PERF/
   SAFETY/RELEASE as the spec touched them). Spawn `rust-reviewer` for a final diff
   audit. Gate owners report pass/fail — don't ask the user about tactical gate details.
4. Delegate to `rust-builder`: write `.rust-studio/specs/<slug>/verify-report.md` from
   `${CLAUDE_PLUGIN_ROOT}/docs/templates/verify-report.md` — each criterion → pass/fail
   + evidence, commands run, gates cleared, follow-ups.
5. **On pass**: mark the spec `Status: Done` (delegate write). Note any durable learning
   worth `/remember`-ing; suggest `/changelog` if user-facing; suggest `/commit` + `/pr`
   to ship — these are outward/irreversible, so confirm before running them.
   **On fail**: list each failing criterion with its gap; hand back to `/dev-task`.

## Output
A criterion-by-criterion verdict with evidence, then **COMPLETE / NEEDS WORK / BLOCKED**.
No green claim without the command output to back it.
