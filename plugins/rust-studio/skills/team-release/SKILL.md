---
name: team-release
description: "release publish semver bump — orchestrate the full release pipeline: security audit, dependency check, MSRV, changelog, RELEASE-GATE checklist, and a publish dry-run. Use before any crates.io publish."
argument-hint: "[version]"
user-invocable: true
---

# /team-release — audit, document, and gate a crate release

Orchestrate the release team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.** Gate at phase boundaries (quality gates, not
per-step permission asks) per `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`.

## Team composition
`release-lead` (owns RELEASE-GATE) · `security-auditor` · `dependency-manager` ·
`docs-engineer` · `rust-reviewer` (audit) · `rust-builder` (writes).

## Input
`$ARGUMENTS` is the target version (e.g. `1.2.0`). If empty, `AskUserQuestion`: "What
version are you releasing? (If you don't know yet, answer 'determine' and we'll derive it
from the API review.)"

---

## Phase 1 — Semver bump determination

- Spawn `release-lead` + `rust-reviewer` to run `/api-review` against the current branch
  (vs. the last published tag). Review the output for breaking changes, additions, and
  fixes.
- Derive the correct semver bump: **patch / minor / major** with a one-sentence rationale.
- If `$ARGUMENTS` was supplied, confirm it matches the derived bump; flag any mismatch.
- Present the determined version and bump type.
- **Gate:** `AskUserQuestion` — confirm the target version before any files are touched.
  If the user disagrees, discuss the delta until aligned.

---

## Phase 2 — Parallel audits

Run all three audit tracks in parallel once the version is confirmed.

### 2a — Security audit
- Spawn `security-auditor` to run `/security-audit` on the crate surface being released.
  Focus on: input validation, deserialization, `unsafe` blocks, dependency advisories.
  Rules: `${CLAUDE_PLUGIN_ROOT}/rules/security.md`.
- Output: a findings list (`CLEAN` / severity-ranked issues). Any **HIGH** or **CRITICAL**
  finding blocks Phase 4 until resolved.

### 2b — Dependency audit
- Spawn `dependency-manager` to run `/deps-check`:
  - `cargo tree` + `cargo audit` for advisories and duplicate major versions.
  - Confirm all `[dependencies]` have explicit version constraints (no bare `*`).
  - Flag any dependency that would pin consumers below the declared MSRV.

### 2c — MSRV verification
- `release-lead` runs `/msrv-check` to confirm the declared `rust-version` field in
  `Cargo.toml` compiles clean on that toolchain.
- If MSRV is absent, derive the minimum from the edition and async/feature use (state rationale); `rust-builder` adds it — no separate approval needed for a new field.

- **Gate:** `AskUserQuestion` — show a combined audit summary (security / deps / MSRV).
  The user must explicitly accept, request fixes, or choose to proceed with noted
  exceptions. Do not advance to Phase 3 with unacknowledged HIGH/CRITICAL findings.

---

## Phase 3 — Documentation

Run both tracks in parallel after audit acceptance.

### 3a — Changelog
- Spawn `docs-engineer` to run `/changelog` and produce a draft changelog entry for the
  target version: `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`
  per Keep-a-Changelog convention.
- Use the template at `${CLAUDE_PLUGIN_ROOT}/docs/templates/changelog-entry.md`.
- `rust-builder` writes the entry to `CHANGELOG.md` only after the user approves the draft.

### 3b — Doc updates
- `docs-engineer` audits rustdoc coverage for every public item added or changed in this
  release: `# Examples`, `# Errors`, `# Panics` where applicable. Flag missing or stale
  docs; delegate corrections to `rust-builder`.
- Update the crate-level `//!` doc and `README.md` version badge / feature table if
  affected.

- **Gate:** `AskUserQuestion` — show the changelog draft + doc-coverage report for
  approval. `rust-builder` does not write until you approve.

---

## Phase 4 — RELEASE-GATE checklist + dry-run

`release-lead` runs the full **RELEASE-GATE** checklist:

| # | Check | Evidence required |
|---|-------|-------------------|
| 1 | `version` in `Cargo.toml` bumped to target | `rg '^version'` output |
| 2 | `CHANGELOG.md` entry present for target version | file excerpt |
| 3 | `rust-version` (MSRV) field present and verified | `/msrv-check` output |
| 4 | `cargo audit` clean (or exceptions noted) | full output |
| 5 | `cargo nextest run --all-features` passes (fall back: `cargo test --all-features`) | test summary |
| 6 | `cargo clippy --all-targets --all-features -- -D warnings` passes | exit 0 |
| 7 | `cargo fmt --check` clean | exit 0 |
| 8 | Security findings resolved or explicitly accepted | findings list |
| 9 | `cargo publish --dry-run` exits 0 | full output |

- `rust-builder` bumps the `version` field in `Cargo.toml` then runs `cargo update -p <crate>
  --precise <version>` to refresh `Cargo.lock`; do this before the checklist run so evidence
  reflects the final version.
- Run `cargo publish --dry-run` and paste the complete output. If it errors, diagnose and
  delegate the fix to `rust-builder` before looping.
- `rust-reviewer` performs a final diff audit; any new findings are surfaced before Go/No-Go.
- **Gate:** `AskUserQuestion` — show the completed checklist with evidence. Any failing row
  is a NEEDS WORK item that must be resolved or explicitly waived before proceeding.

---

## Phase 5 — Go / No-Go

`release-lead` delivers the final verdict.

**If GO:** present the exact manual publish commands for the user to run. **Never
auto-publish.** Example:

```
# Review one last time, then run:
cargo publish -p <crate-name>

# After publishing, tag the release:
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

- Summarize: version, semver bump justification, audit outcomes, changelog entry, doc
  coverage, checklist status, and any accepted exceptions with their rationale.
- End with verdict **COMPLETE / NEEDS WORK / BLOCKED** and the manual publish command(s).

**If NO-GO:** list every blocking issue (owner, severity, suggested fix). Completed
work (changelog draft, doc updates) is preserved. State which phase to re-enter after
fixes.

---

## Error recovery

Any agent returns **BLOCKED** → surface it immediately, do not proceed past the blocker,
`AskUserQuestion` with options:

- **(a) Skip and note** — record the gap as an accepted exception; continue with reduced
  confidence.
- **(b) Retry narrower** — re-run the failing check with a more constrained scope.
- **(c) Stop and fix** — halt and run the prerequisite skill (e.g. `/security-audit`,
  `/adr`, `/msrv-check`, `/deps-check`) before resuming.

Never discard completed work. Any phase gate that already produced accepted output remains
valid unless the user requests a re-run.
