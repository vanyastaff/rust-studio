---
name: new-crate
description: "new crate workspace member scaffold — create a crate with studio conventions: Cargo.toml metadata, lints, deny.toml, rust-toolchain, CI stub, lib.rs/main.rs."
argument-hint: "[name] [lib|bin]"
user-invocable: true
disable-model-invocation: true
---

# /new-crate — scaffold a workspace member

Create a new crate or add a workspace member with every studio convention wired up
from the start: manifest metadata, lint config, deny policy, toolchain pin, CI stub,
and a ready-to-extend source file. You are the orchestrator: **you do not write files
yourself — you delegate all writes to `rust-builder`.**

Honor the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`):
decide tactical calls yourself; gate only at phase boundaries and before file writes.

## Input

`$ARGUMENTS` may be `[name]`, `[name] lib`, or `[name] bin`. Parse what is given.
Pre-fill known answers from `$ARGUMENTS`; ask only for what's genuinely missing.

---

## Phase 1 — Clarify

If name and crate type are both supplied, proceed directly to Phase 2 with sensible
defaults for the remaining fields. Otherwise, batch all missing answers into **one**
`AskUserQuestion` with clearly labeled fields:

1. **Name** — snake_case crate name (pre-filled from `$ARGUMENTS` if provided).
2. **Type** — `lib` (default) or `bin`.
3. **Domain** — pick one; it determines deps and source shape:
   - `library` — pure API crate, no async runtime.
   - `async` — async-first service or library (`tokio`, `tower`, etc.).
   - `cli` — command-line binary (`clap`, optional `color-eyre`).
   - `systems` — `no_std`-capable, performance-critical, or FFI-adjacent.
4. **MSRV** — minimum supported Rust version (e.g. `1.81.0`; leave blank to omit).
5. **License** — `MIT OR Apache-2.0` (default), `MIT`, `Apache-2.0`, or custom SPDX.
6. **Workspace member?** — add the new path to the root `[workspace.members]`?

Edition is always `2024`; state this and proceed without asking.

---

## Phase 2 — Pick defaults by domain

Once the domain is known, select the canonical deps and feature flags without asking
again. Present choices as part of the draft.

| Domain    | Default deps (prod + dev)                                        | Notes                         |
|-----------|------------------------------------------------------------------|-------------------------------|
| `library` | `thiserror` (if error types expected)                            | —                             |
| `async`   | `tokio` full; `tracing`; `tracing-subscriber` (dev)              | —                             |
| `cli`     | `clap` derive; `color-eyre` (optional); `tracing`                | —                             |
| `systems` | none by default; `no_std` if requested                           | skip `forbid(unsafe_code)`    |

Consult `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md` for manifest conventions.
Consult the domain rule for dep/feature guidance:
`${CLAUDE_PLUGIN_ROOT}/rules/async.md`, `${CLAUDE_PLUGIN_ROOT}/rules/api.md`,
`${CLAUDE_PLUGIN_ROOT}/rules/cli.md`, `${CLAUDE_PLUGIN_ROOT}/rules/unsafe.md`.

---

## Phase 3 — Draft the file set

Produce a **draft** for user review. Show each file as a named block; do not write
anything yet.

### `Cargo.toml`
Build per `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md`. Must include:
- `[package]`: `name`, `version = "0.1.0"`, `edition = "2024"`, `license`,
  `rust-version` (if MSRV given), `description`, `repository` (placeholder),
  `keywords`, `categories`.
- `[lints.rust]` and `[lints.clippy]` sections per the manifest rule.
- `[dependencies]` and `[dev-dependencies]` for the domain defaults.
- `[features]` stub if domain is `async` or `systems`.

### `src/lib.rs` or `src/main.rs`
- `lib.rs`: `#![forbid(unsafe_code)]` (omit for `systems`), `#![warn(...)]` attrs,
  module-level doc comment, empty `pub mod` stub or `// TODO` note.
  Consult `${CLAUDE_PLUGIN_ROOT}/rules/core.md`.
- `main.rs` (bin): minimal `fn main()` with `color_eyre::install()`? or plain, per domain.
  Consult `${CLAUDE_PLUGIN_ROOT}/rules/cli.md` for CLI entry-point conventions.

### `deny.toml`
Studio-standard cargo-deny config: advisories (deny), licenses (allow list includes the
chosen license), bans (deny duplicates). See `${CLAUDE_PLUGIN_ROOT}/rules/build-scripts.md`.

### `rust-toolchain.toml`
```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
```
Add `profile = "minimal"` for `systems` domain.

### `.github/workflows/<name>-ci.yml` (CI stub)
Minimal GitHub Actions workflow: `cargo check`, `cargo clippy -- -D warnings`,
`cargo nextest run`, `cargo fmt --check`.
See `${CLAUDE_PLUGIN_ROOT}/rules/build-scripts.md` for CI conventions.

### `README.md`
Use `${CLAUDE_PLUGIN_ROOT}/docs/templates/crate-readme.md` as the template.
Fill in crate name, one-line description, license badge, and MSRV badge if applicable.

---

## Phase 4 — Approve (gate)

`AskUserQuestion`: present the draft file set and ask the user to confirm or adjust.
Include workspace membership status. Revise and re-present if the user requests changes.
**Do not delegate to `rust-builder` until the user gives explicit approval** — writing
files is irreversible.

---

## Phase 5 — Build

Spawn **`rust-builder`** with the approved plan. Instruct it to:
- Write all files exactly as approved.
- If workspace: `true`, add the new path to `[workspace.members]` in the root `Cargo.toml`.
- Run `cargo check -p <name>` and `cargo clippy -p <name> --all-targets -- -D warnings`
  after writing to confirm the scaffold compiles clean.
- Report command output (even if successful).

`rust-builder` reports a file list and command output. Show both to the user.

---

## Phase 6 — Verdict and next steps

Summarize: files written, `cargo check`/`clippy` result, workspace status.
End with **COMPLETE / NEEDS WORK / BLOCKED**.

Suggest follow-on skills as appropriate:
- `/add-dep` — to add dependencies beyond the domain defaults.
- `/test-setup` — to wire up nextest, test helpers, or fixture infrastructure.
- `/dev-task` — to begin the first real feature inside the new crate.
- `/review` — for a standards audit before writing any code.

---

## Error recovery

If `rust-builder` returns **BLOCKED** or a compile error:
- Surface the error immediately.
- `AskUserQuestion` with options: (a) fix the specific file and retry, (b) narrow scope
  (e.g. skip the CI stub), (c) stop and diagnose manually.
- Never discard files that were already written successfully.
