---
name: publish
description: "crates.io publish release prepare — run RELEASE-GATE checklist, dry-run, and hand the exact publish command to you. Never publishes automatically."
argument-hint: "[crate]"
user-invocable: true
---

# /publish — prepare a crates.io release

Walk a crate through the **RELEASE-GATE checklist → dry-run → hand the exact publish
command to you**. The studio **never runs `cargo publish` itself** — publishing is
irreversible; that call is always yours.

Honors the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).
You are the orchestrator: **you do not write files directly — delegate all file writes to
`rust-builder`.**

## Input

`$ARGUMENTS` is the crate name (or path). If the workspace has multiple publishable crates,
derive the order automatically (see Phase 1). If `$ARGUMENTS` is empty, ask: "Which crate
should we prepare for publish?" before proceeding.

## Phase 1 — Scope & publish order

1. Spawn **`rust-scout`** to locate the target crate's `Cargo.toml`, identify its
   workspace membership, and map any intra-workspace `path` dependencies.
2. If the crate has `path` dependencies on other unpublished workspace members, determine
   a topological publish order (dependencies first). Present the order and confirm before
   continuing — publish order is load-bearing and irreversible.
3. Restate what will be published (crate, version, order) in 1–3 bullets.

## Phase 2 — RELEASE-GATE checklist

Spawn **`release-lead`** to run the RELEASE-GATE (owner: `release-lead`).
For each item, cite the concrete evidence (file contents, command output, or "skipped —
not applicable"):

| # | Check | Tool / evidence |
|---|-------|-----------------|
| 1 | `version` bumped per semver | `Cargo.toml` version field |
| 2 | `CHANGELOG` updated for this version | changelog entry present |
| 3 | MSRV declared and verified | `rust-version` in `Cargo.toml`; `cargo +<msrv> check`; `cargo hack --each-feature check` for feature-gated paths |
| 4 | `cargo publish --dry-run` clean | full command output (see Phase 3) |
| 5 | Packaged file list reviewed | `cargo package --list` output — no secrets, no build artefacts |
| 6 | Public API documented | `cargo doc --no-deps` exits 0; no missing-docs warnings; `cargo public-api` for surface snapshot |
| 7 | API-GATE cleared (if public surface changed) | `cargo semver-checks`; `api-design-lead` sign-off or "no API change" |
| 8 | `[package.metadata]` fields correct | `description`, `license`, `repository`, `keywords`, `categories` |
| 9 | No yanked / broken dependency versions | `cargo deny check` (or `cargo audit`); `cargo tree`; `cargo +stable check` |
| 10 | CI green on the target branch | link to passing run, or local evidence |

If **`api-design-lead`** sign-off is needed (item 7), spawn `api-design-lead` to confirm
the API-GATE before continuing.

## Phase 3 — Dry-run

Run the following commands (non-mutating — no approval needed per protocol §1):

```
cargo publish --dry-run [--package <crate>]
cargo package --list    [--package <crate>]
cargo deny check        [or: cargo audit]
```

Paste the **full output** of each. If any fails, classify each error as:

```
🔴 BLOCKER: <problem>. <fix>.
🟡 WARNING: <problem>. <fix>.
```

Do not proceed to Phase 4 until all BLOCKERs are resolved. Hand blockers to
**`rust-builder`** (delegate writes; never write directly). Re-run the dry-run after
each fix and show the updated output.

## Phase 4 — Surface blockers & approve

`AskUserQuestion`: present the RELEASE-GATE checklist results and the dry-run output.
List any unresolved warnings. Ask for explicit go-ahead before presenting the final
command — publishing is irreversible and outward.

If the user wants fixes, loop: delegate to `rust-builder` (for code/metadata changes) or
ask the user to clear the external blocker (e.g. CI, token), then re-run Phases 2–3.

## Phase 5 — Present the publish command

Once the gate is clean and the user has approved, present — **but do not run** — the exact
command(s) for the user to execute:

```
# Run this yourself — publishing is irreversible:
cargo publish [--package <crate>] [--registry <reg>]
```

For workspace publish sequences, list the commands in dependency order with a note to
verify each succeeds before running the next.

State clearly: **"The studio does not run `cargo publish`. Copy and run the command above
when you are ready."**

## Phase 6 — Hand off

After the user confirms they have published (or decides to defer):

- Suggest `/changelog` to finalise or update the changelog entry for this release.
- Suggest tagging the release commit: `git tag v<version> && git push --tags`.
- If any non-blocking warnings were noted, offer `/review` to address them in a follow-up.

End with verdict **COMPLETE / NEEDS WORK (numbered blockers) / BLOCKED**.

## Error recovery

If any sub-agent returns **BLOCKED** (missing ADR, unresolved dependency, absent token):
surface it immediately with `AskUserQuestion`, options — (a) resolve the blocker and retry,
(b) narrow scope (e.g. publish a subset of crates), (c) stop. Never discard completed
checklist work.
