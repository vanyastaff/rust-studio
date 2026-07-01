---
name: add-dep
description: "Add a Rust dependency / add-dep / vet a crate — run the full vetting pipeline (RUSTSEC, license, MSRV, features) before touching Cargo.toml."
argument-hint: "[crate name]"
user-invocable: true
disable-model-invocation: true
---

# /add-dep — vet and add a Rust dependency

Run a crate through the full vetting pipeline before it touches `Cargo.toml`, honoring the
collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You are the
orchestrator: **you do not edit manifests or lock files yourself — you delegate writes to
`rust-builder`.**

## Input

`$ARGUMENTS` is the crate name. If empty, ask: "Which crate do you want to add?" If the
caller also specifies a version constraint or feature list, record it for validation in Phase 2.

## Phase 1 — Scope check (autonomous)

Before vetting, decide tactical questions yourself and state the rationale:
- Does an existing workspace dep already cover the need? Check with `cargo tree` or serena.
- Could a stdlib type or a small local helper replace it? State your conclusion and proceed.
- Record any caller-supplied version, feature, or target constraints (WASM, `no_std`, MSRV).

If the intended use is genuinely ambiguous (no $ARGUMENTS, no context), ask once: "What
problem does this crate solve?" Then proceed.

## Phase 2 — Vet (spawn dependency-manager)

Spawn **`dependency-manager`** to run the full vetting checklist. Use the **exa** MCP
(`mcp__exa__web_search_exa`, `mcp__exa__web_fetch_exa`) for external evidence —
crates.io trajectory, RUSTSEC advisories, peer-project adoption — rather than guessing.
Every item below must be reported; "unknown" is valid, silence is not.

### Security — advisories
- Run `cargo audit` and `cargo deny check`; cross-reference the [RUSTSEC advisory DB](https://rustsec.org/).
- Flag active advisories (severity, CVE ID, patched version if available).
- Unmaintained crates with no active advisory are still flagged as a maintenance risk.

### Maintenance & popularity
- Last release date, open issues trend, active maintainers, archived/read-only repo.
- crates.io download trajectory (growing / flat / declining) — use exa for this.
- If effectively unmaintained, surface an alternative.

### License vs. `deny.toml`
- Identify the SPDX license expression.
- Check against `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md` and the project's `deny.toml`.
- Flag any mismatch or dual-license complexity.

### MSRV impact
- What Rust version does the crate require?
- Compare against the project's declared `rust-version` in `Cargo.toml`.
- A crate that raises the MSRV requires explicit approval.

### Feature set — prefer minimal
- List available features and their transitive cost (dep count, compile time, binary size).
  Use `cargo tree -f "{p} {f}"` and `cargo hack` for feature-combination analysis.
- Default recommendation: `default-features = false`, then opt in only to needed features.
- Flag any feature that pulls in `tokio`, `serde`, `openssl`, or other heavy transitive
  trees unless already in the workspace.

### Alternatives comparison
- Identify 1–2 realistic alternatives (including "write it yourself" for small crates).
- Present a brief comparison table: maintenance health, license, MSRV, feature-weight,
  API ergonomics, adoption.

### Template record
- Write the findings to `docs/dependency-review.md` in the project, using
  `${CLAUDE_PLUGIN_ROOT}/docs/templates/dependency-review.md` as the template.
  `dependency-manager` drafts the record; do not write it yourself.

## Phase 3 — Present findings (gate)

Show the vetting report to the user:
- Security status (clean / advisory / unmaintained).
- License verdict (approved / needs review / blocked).
- MSRV verdict (compatible / would raise MSRV).
- Recommended feature set (`default-features = false` + explicit list).
- Alternatives table.

If any item is a hard block (active critical advisory, license conflict, MSRV regression
with no workaround), state **BLOCKED** with the reason and suggested remediation and stop.

Soft concerns (unmaintained, heavy feature pull) are presented as risks for the user to accept.

## Phase 4 — Approve (gate)

`AskUserQuestion`: present the recommended `cargo add` invocation (crate, version constraint,
`--no-default-features`, `--features <list>`) and the completed review record. Get explicit
approval before any manifest is touched.
- If the user prefers an alternative, loop back to Phase 2 with the new name.
- If the user wants to adjust the feature set, update the recommendation and re-confirm.

## Phase 5 — Add

Delegate to **`rust-builder`** with the approved invocation:
```
cargo add <crate>[@<version>] [--no-default-features] [--features <f1,f2,...>]
```
`rust-builder` runs the command and reports the resulting `Cargo.toml` diff and any change
to `Cargo.lock`. Show the diff.

## Phase 6 — Post-add checks

Run `/deps-check` to verify the workspace still builds cleanly and no new advisory was
introduced by the transitive update. If issues surface, hand them back to `rust-builder`
(adjust features, pin a version, or revert) — do not proceed to verdict until clean.

## Phase 7 — Verdict

Summarize: crate added, version pinned, features selected, MSRV status, license verdict,
advisory status, anything deferred. End with **COMPLETE / NEEDS WORK / BLOCKED**.

Suggest next steps: `/dev-task` to wire up the new API, `/review` if the integration
touches a public surface, `/team-release` if this bumps MSRV or changes the public dependency
surface of a published crate.

## Error recovery

If `dependency-manager` returns **BLOCKED** (cannot resolve advisory, `deny.toml` conflict,
MSRV hard stop): surface the blocker immediately, do not add the crate, and
`AskUserQuestion` with options — (a) pick an alternative, (b) accept the risk explicitly,
(c) stop and resolve the prerequisite (e.g. update `deny.toml`, bump MSRV after `/dev-task`
confirms compatibility). Never discard a completed review record.
