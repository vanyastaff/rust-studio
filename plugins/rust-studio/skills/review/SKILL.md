---
name: review
description: "review, audit, check — inspect a Rust diff or path for correctness bugs, soundness, scope creep, missing tests, and standards violations. Runs clippy and tests as evidence. Use before committing or merging."
argument-hint: "[optional path or git ref] [--full for parallel multi-lens]"
user-invocable: true
---

# /review — audit a Rust change

Review the change for real problems and produce a prioritized, severity-tagged findings
list with a merge verdict. Evidence over opinion (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).
Flag only correctness, soundness, security, and requirement gaps — not style or
over-engineering (`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md` §"don't over-report").

## Scope
`$ARGUMENTS` may be a path or a git ref. Default to the working-tree diff
(`git diff` + staged + untracked `.rs`). State what you're reviewing.
If the intended story/acceptance criteria aren't in the diff, infer from context
and proceed — ask only if the diff is genuinely ambiguous about its goal.

## How to run
1. Get the diff. Determine scope from context; proceed without asking unless the
   change's goal is truly opaque.
2. Spawn **`rust-reviewer`** for the core correctness/scope/test audit.
3. **Full review** (`--full`, or for breaking / public-API / large diffs): fan out the
   relevant lenses **in parallel**, then merge and de-duplicate findings. This is the
   multi-lens pass — it replaces the former `/team-review`:
   - `unsafe-auditor` if the diff touches `unsafe` (SAFETY-GATE).
   - `security-auditor` if it touches input parsing, auth, deserialization, or FFI.
   - `perf-engineer` if it touches hot paths or benches (PERF-GATE).
   - `api-design-lead` if it changes the public surface (API-GATE / semver).
   - `async-systems-lead` if it touches async/handlers (ASYNC-GATE).
   - `harsh-critic` if the change embeds a non-trivial design/approach decision — to attack
     the shape, not just the lines.
4. Run evidence commands and cite output:
   - `cargo clippy --all-targets --all-features -- -D warnings`
   - `cargo nextest run` (fall back to `cargo test`)
   - `cargo +nightly miri test` when `unsafe` is involved (if available)
   - `cargo semver-checks` when the public API surface changes
   - `cargo audit` / `cargo deny check` when dependencies change

## Output
Merge and de-duplicate findings, ordered by severity, one line each:

```
path:line  🔴 BUG: <problem>. <fix>.
path:line  🟠 SOUNDNESS / SAFETY: <problem>. <fix>.
path:line  🟡 SCOPE / MAINTAINABILITY: <problem>. <fix>.
path:line  🔵 TEST-GAP: <uncovered behavior>. <add test>.
```

Skip empty categories — no padding, no praise. End with verdict **COMPLETE (merge) /
NEEDS WORK (numbered blockers) / BLOCKED**, plus the clippy/test summary. Offer to hand
blockers to `rust-builder` via `/dev-task`.
