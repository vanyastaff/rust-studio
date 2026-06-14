---
name: msrv-check
description: "msrv rust-version minimum supported Rust version verify pin check — determine the real MSRV, compare to declared rust-version in Cargo.toml, flag deps that raise it, feed the RELEASE-GATE. Use before a release or whenever a dependency changes."
argument-hint: "[optional version]"
user-invocable: true
---

# /msrv-check — verify and pin the minimum supported Rust version

Determine the real MSRV, compare it to the declared `rust-version` in `Cargo.toml`, and
produce a concrete update recommendation. You are the orchestrator — you do not write files
directly; all manifest edits are delegated to `rust-builder`. Decide tactical calls
yourself; `AskUserQuestion` only at genuine forks and before outward/irreversible actions
(see `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §1).

## Input

`$ARGUMENTS` may be an explicit Rust version (e.g. `1.75`). If provided, use it as the
target floor instead of auto-detecting. If empty, proceed with auto-detection.

## Phase 1 — Locate and read the manifest

Spawn **`rust-scout`** to locate all `Cargo.toml` files in the workspace and read:
- The top-level `rust-version` field (if present).
- Every `[dependencies]` / `[dev-dependencies]` / `[build-dependencies]` entry.
- The `[workspace.package]` `rust-version` if this is a virtual manifest.

Record the declared MSRV (or "not set") and the full dependency list — proceed immediately.

## Phase 2 — Determine the real MSRV

Run **non-mutating** probe commands (no approval needed per the protocol):

**Option A — cargo-msrv (preferred if installed):**
```
cargo msrv find --output-format json
```
Parse the `msrv` field from the JSON output.

**Option B — binary search with `cargo +<ver> check` (fallback):**
Start from the declared `rust-version` (or `1.56` if unset) and bisect upward using
`cargo +<toolchain> check --all-targets --all-features` until the first version that
compiles cleanly. Use `rustup toolchain list` to know what is installed.

State which method was used and show its raw output as evidence.

## Phase 3 — Identify MSRV-raising dependencies

Run:
```
cargo tree --edges features -e no-dev
```

Then extract each direct dependency's published `rust-version` via:
```
cargo metadata --format-version 1 --no-deps | jq '.packages[] | {name, version, rust_version}'
```

For any dep not covered by `cargo metadata`, query crates.io via the **exa** MCP
(`mcp__exa__web_search_exa`) or `gh` to find its published MSRV. Flag any dep whose
minimum `rust-version` exceeds the current declared MSRV. Produce a table:

```
crate            declared MSRV   effect
-------          -------------   ------
serde 1.0.197    1.70            raises floor to 1.70
tokio 1.37        1.63            within floor
```

## Phase 4 — Compare and decide

Present the findings:

- **Declared** `rust-version` in `Cargo.toml` (or "not set").
- **Real MSRV** from Phase 2.
- **Dep-driven floor** from Phase 3.
- **Effective MSRV** = max(real, dep-driven floor).

If declared == effective, state so and stop — no changes needed.

If they differ, `AskUserQuestion` with 2–4 options:

1. **Update `rust-version` to `<effective>`** (recommended) — keeps the manifest honest.
2. **Pin or downgrade the offending dep(s)** — if you need a lower floor.
3. **Keep current declaration and add a comment** — document the known drift.
4. **No change** — if this is a pre-release investigation only.

Apply the rule from `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md` when evaluating
manifest edits.

## Phase 5 — Draft and approve (gate)

After the user picks an option, produce a **draft diff** showing:

- The updated `rust-version` line in each affected `Cargo.toml`.
- Any version pin changes for offending deps.
- A one-line note for the CI matrix section (e.g. `.github/workflows/*.yml`) listing the
  toolchain to add or remove.

Show the draft; do **not** apply it until the user approves.

## Phase 6 — Apply (delegated)

On approval, spawn **`rust-builder`** with the exact diff from Phase 5. Instruct it to:

- Edit only the manifest and CI files listed in the approved diff.
- Run `cargo +<effective-msrv> check --all-targets --all-features` after editing to
  confirm the declared version actually compiles.
- Run `cargo clippy --all-targets --all-features -- -D warnings` on stable.
- Report command output verbatim.

## Phase 7 — RELEASE-GATE feed

After a clean run, summarize findings for **`release-lead`** (RELEASE-GATE owner):

```
MSRV-CHECK RESULT
  Declared rust-version : <before> → <after>
  Effective MSRV (real) : <detected>
  Dep-driven floor      : <crate @ version, if any>
  cargo check (MSRV)    : PASS / FAIL
  cargo clippy (stable) : PASS / FAIL
  CI matrix update      : <yes — added 1.NN / no>
  Recommendation        : RELEASE-GATE <clear / blocked>
```

If any check failed, end with **NEEDS WORK** and list the blockers. If all passed, end with
**COMPLETE — RELEASE-GATE clear for MSRV**.

## Error recovery

- If `cargo-msrv` is not installed and no toolchains are available for bisection,
  `AskUserQuestion`: (a) install `cargo-msrv` (`cargo install cargo-msrv`), (b) install a
  specific toolchain via `rustup`, or (c) accept a manually supplied version as `$ARGUMENTS`.
- If `rust-builder` returns **BLOCKED** (e.g. a workspace dep lacks a compatible release),
  surface the blocker and offer to run `/dev-task` to address the dependency upgrade
  separately. Never discard the MSRV-check findings.
