---
name: security-audit
description: "security audit, vulnerability, injection, secrets, RUSTSEC — review CODE for attacker-facing risk (untrusted input, injection, deserialization, auth, secret leaks) plus supply-chain advisories (cargo-audit). For dependency version/feature/license hygiene use /deps-check instead."
argument-hint: "[optional scope: crate name, path, or focus area]"
user-invocable: true
---

# /security-audit — run a security audit

Run the full security audit pipeline through **scope → scan → review → report → fix**,
honoring the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).
You are the orchestrator: **you do not write fixes yourself — you delegate writes to
`rust-builder`.** Gate with `AskUserQuestion` only at phase boundaries (triage, fix
authorization, BLOCKED recovery) — decide tactical calls yourself, state choice + one-line
rationale.

## Input
`$ARGUMENTS` is an optional scope — a crate name, path, or focus area (e.g. `"auth"`,
`"crates/api"`). If empty, audit the entire workspace. State the scope before starting.
If `$ARGUMENTS` is ambiguous, ask: "Should I audit the whole workspace or a specific
crate/area?" then proceed.

## Phase 1 — Scope & locate
1. Restate the audit scope in 1–2 bullets.
2. Spawn **`rust-scout`** to map relevant files: input boundaries, deserialization sites,
   auth paths, FFI, and any existing `// SAFETY:` annotations.
   Scout uses serena MCP for symbol/reference navigation and `rg` for macro-generated or
   `cfg`-gated sites serena can't see — never Bash `grep`/`find`.

## Phase 2 — Automated scans (parallel, read-only — no approval needed)
Spawn **`security-auditor`** to run all of the following and collect raw output:

- **`cargo audit`** — check dependencies against the RustSec advisory database (RUSTSEC).
  Treat any `RUSTSEC-` advisory as a finding. Note yanked crates and unmaintained warnings.
  Use the exa MCP (`web_search_exa`) to look up RUSTSEC advisory details or upstream fix
  status when the `cargo audit` summary is thin.
- **`cargo deny check advisories bans licenses`** — enforce advisory denies, crate bans,
  and license policy. Surface any `deny` or `warn` items.
- **Secret scan** — use `rg` to search for patterns that suggest hardcoded secrets: API
  keys, tokens, passwords, private-key material in `*.rs`, `*.toml`, `*.env*`, and config
  files. Flag exact file:line references; do not redact in the report.
- **Dependency tree** — run `cargo tree --duplicates` and flag duplicated crates that are
  known to have past advisories, and any `git = ...` or `path = ...` dependencies that
  bypass crates.io integrity checks.

`security-auditor` reports raw findings only; do not fix yet.

## Phase 3 — Manual review
Spawn **`security-auditor`** to review the code identified by `rust-scout` for the
following vulnerability classes:

- **Untrusted-input boundaries** — deserialization (`serde`, `bincode`, manual parsers),
  network/IPC input, CLI args fed into commands or file paths. Look for missing length
  checks, unchecked `from_utf8`/`from_str`, and format-string injection.
- **Authentication and authorization** — token/session validation logic, time-of-check /
  time-of-use (TOCTOU) races, missing `constant_time_eq` on secret comparisons.
- **Integer overflow and panics as DoS** — arithmetic on untrusted values without checked
  arithmetic (`checked_add`, `saturating_*`), slice indexing with user-controlled offsets,
  `unwrap`/`expect` on paths reachable from external input.
- **`unsafe` exposure** — any `unsafe` block that processes untrusted data; verify
  `// SAFETY:` invariants hold under adversarial input. Escalate to `unsafe-auditor`
  (SAFETY-GATE) if findings are present.
- **FFI boundaries** — null pointer dereferences, unvalidated C string lengths, ownership
  transfer across the FFI boundary.

## Phase 4 — Triage & options (gate)
Collect all findings from Phases 2 and 3. Present them severity-tagged:

```
path:line  🔴 CRITICAL: <problem>. <recommended fix>.
path:line  🔴 HIGH:     <problem>. <recommended fix>.
path:line  🟠 MEDIUM:   <problem>. <recommended fix>.
path:line  🟡 LOW:      <problem>. <recommended fix>.
path:line  🔵 INFO:     <observation — no fix required>.
```

Skip empty severity levels — no padding, no praise.

`AskUserQuestion`: show the full findings list and ask:
- Which findings should be fixed now vs. deferred?
- Are any findings false positives to suppress?
- Should CRITICAL/HIGH blockers hold the RELEASE-GATE?

Present 2–4 options where there are meaningful trade-offs (e.g. upgrade a dep vs. patch vs.
add a `cargo deny` exception). Wait for the decision before proceeding.

## Phase 5 — Fix (gate)
For each finding approved for fixing:

1. Spawn **`rust-builder`** with a precise fix plan (file, line, what to change, why).
   Instruct it to:
   - stay strictly in scope — no opportunistic refactors,
   - run `cargo nextest run` (fall back to `cargo test`), `cargo audit`, and
     `cargo clippy --all-targets --all-features -- -D warnings` after each fix,
   - add or update `// SAFETY:` notes on any `unsafe` it touches,
   - for dependency upgrades: update `Cargo.toml`, run `cargo update`, then
     `cargo deny check`.
2. `rust-builder` reports a diff summary and command output. Show it to the user.
3. If `unsafe` was involved, spawn **`unsafe-auditor`** to clear SAFETY-GATE before
   marking that finding resolved.

Repeat until all approved findings are resolved or the user stops.

## Phase 6 — RELEASE-GATE feed
Produce a final audit summary for `release-lead`:

- List of CRITICAL/HIGH findings and their resolution status (fixed / deferred / suppressed).
- `cargo audit` exit status after fixes.
- `cargo deny check` exit status after fixes.
- Any remaining open items that should block the RELEASE-GATE, with justification.

If any CRITICAL or HIGH findings remain unresolved, the RELEASE-GATE is **BLOCKED** — state
this explicitly. `release-lead` must acknowledge before shipping.

## Verdict
End with **COMPLETE / NEEDS WORK / BLOCKED**:

- **COMPLETE** — no CRITICAL/HIGH findings remain open; evidence (`cargo audit` + `cargo deny`
  output) is shown; RELEASE-GATE can proceed.
- **NEEDS WORK** — specific numbered findings are still open; each has a suggested owner
  and next step.
- **BLOCKED** — a hard dependency is missing (e.g. unmaintained crate with no upgrade path,
  unresolved RUSTSEC advisory under active exploit); named with a suggested next step.
  Completed fixes are never discarded.

Suggest next steps: `/review` for a broader correctness audit, `/dev-task` to implement
a non-trivial fix, `/publish` once the RELEASE-GATE is clear.

## Error recovery
If `cargo audit` or `cargo deny` is not installed, instruct the user to run
`cargo install cargo-audit` / `cargo install cargo-deny` and pause. Do not proceed with
an incomplete scan and silently declare it clean.

If `security-auditor` returns **BLOCKED** (e.g. a design decision is needed about a
vulnerable dependency), surface it immediately, do not skip the blocker, and
`AskUserQuestion` with options — (a) defer and note the gap, (b) replace the dependency,
(c) stop and open an ADR. Never mark the audit COMPLETE while a BLOCKED finding is live.
