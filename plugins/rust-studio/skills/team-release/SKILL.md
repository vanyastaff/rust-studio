---
name: team-release
description: "release publish semver bump — orchestrate the full release pipeline: security audit, dependency check, MSRV, changelog, RELEASE-GATE checklist, and a publish dry-run. Use before any crates.io publish."
argument-hint: "[version]"
user-invocable: true
---

# /team-release — audit, document, and gate a crate release

Orchestrate the release team through structured phases. **Delegate all file writes to
sub-agents; the orchestrator never writes.** Gate at phase boundaries (quality gates, not
per-step permission asks) per `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` (§8 team
execution).

## Orchestration & progress
Execute the phases as an agent team per **`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §8**
(implicit session team, shared task list with `addBlockedBy` ordering, `SendMessage`, teammate
shutdown). Gate on `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`: if unset, fall back to
single-orchestrator delegation — spawn sub-agents sequentially and inline each phase's context
into the spawn prompt.

Keep the **task list live** when `progress_tracking` is on (`${user_config.progress_tracking}`,
default on): one `TaskCreate` per phase up front, flip to `in_progress` before each phase and
`completed` the moment it yields a result (surfaced in one line) so the user sees intermediate
progress, not a final dump. Foreground the phase being waited on. Off → no task-list narration.

## Team composition
`release-lead` (owns RELEASE-GATE) · `security-auditor` · `dependency-manager` ·
`docs-engineer` · `rust-reviewer` (audit) · `rust-builder` (writes).

## Input
`$ARGUMENTS` is the target version (e.g. `1.2.0`). If empty, `AskUserQuestion`: "What
version are you releasing? (If you don't know yet, answer 'determine' and we'll derive it
from the API review.)"

---

Create one task per phase via `TaskCreate`; chain them with `addBlockedBy` (1 → 2 → 3 → 4 →
5) and assign each to its owning agent with `TaskUpdate owner`. Phases 2 and 3 each fan out
into independent tracks — create them as sibling tasks (same blocker, no dependency between
them) so they run concurrently as teammates; the lead synthesizes when all report via
`SendMessage`.

## Phase 1 — Semver bump determination

- **Recall first:** `/recall <crate> release` (or reuse the session-start memory index) and paste
  what binds — prior semver calls, MSRV policy, publish gotchas — INTO the team spawn prompts
  (teammates do not inherit session context); say when a recalled note changes the approach. If
  nothing surfaces, proceed (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
- Task owned by `release-lead` (with `rust-reviewer`) to run `/api-review` against the current
  branch (vs. the last published tag). Review the output for breaking changes, additions, and
  fixes.
- Derive the correct semver bump: **patch / minor / major** with a one-sentence rationale.
- If `$ARGUMENTS` was supplied, confirm it matches the derived bump; flag any mismatch.
- Present the determined version and bump type.
- **Gate:** `AskUserQuestion` — confirm the target version before any files are touched.
  If the user disagrees, discuss the delta until aligned.

---

## Phase 2 — Parallel audits (blocked by 1)

Run all three audit tracks in parallel once the version is confirmed — create one sibling
task per track (2a/2b/2c) so they run concurrently as teammates.

### 2a — Security audit
- Task owned by `security-auditor` to run `/security-audit` on the crate surface being
  released. Focus on: input validation, deserialization, `unsafe` blocks, dependency
  advisories. Rules: `${CLAUDE_PLUGIN_ROOT}/rules/security.md`.
- Output: a findings list (`CLEAN` / severity-ranked issues). Any **HIGH** or **CRITICAL**
  finding blocks Phase 4 until resolved.

### 2b — Dependency audit
- Task owned by `dependency-manager` to run `/deps-check`:
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

## Phase 3 — Documentation (blocked by 2)

Run both tracks in parallel after audit acceptance — create one sibling task per track
(3a/3b) so they run concurrently as teammates.

### 3a — Changelog
- Task owned by `docs-engineer` to run `/changelog` and produce a draft changelog entry for
  the target version: `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`
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

## Phase 4 — RELEASE-GATE checklist + dry-run (blocked by 3)

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

## Phase 5 — Go / No-Go (blocked by 4)

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
  coverage, checklist status, and any accepted exceptions with their rationale. Every
  teammate's contribution ends in **COMPLETE / NEEDS WORK / BLOCKED** with evidence.
- **Persist what settled:** sweep ALL teammate verdicts for `MEMORY:` lines and run `/remember`
  for each (it dedups); `/remember` team-level decisions (semver rationale, accepted exceptions,
  release gotchas) too — or state "nothing durable"
  (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
- End with verdict **COMPLETE / NEEDS WORK / BLOCKED** and the manual publish command(s).
- If running as a team, shut each teammate down with `SendMessage {type:"shutdown_request"}`
  (no `TeamDelete` — the team is implicit).

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
