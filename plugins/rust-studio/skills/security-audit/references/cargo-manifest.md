---
name: cargo-manifest
paths: "**/Cargo.toml"
description: Cargo.toml / dependency hygiene
---

# Cargo Manifest Standards

Applies to every `Cargo.toml`.

## Versions & dependencies
- No wildcard (`"*"`) or overly-loose version requirements. Pin with caret (`"1.2"`)
  and let the lockfile handle exact versions.
- Justify every new dependency: is it maintained, audited, and worth the compile-time +
  supply-chain cost? Prefer std or a small focused crate over a kitchen-sink one.
- Enable only the features you use: `default-features = false` + explicit `features`
  for heavy deps (tokio, reqwest, serde). Avoid feature unification surprises.
- Run `cargo deny check` (advisories, bans, licenses, sources) and `cargo audit`.
- **Publish-age cooldown.** A compromised maintainer account publishes a malicious version
  and it is pulled within hours — `arrayref 0.3.10` was live on crates.io for 86 minutes on
  2026-08-20 (with `internment 0.8.7`, `append-only-vec 0.1.9`, and a `proc-macro1` build
  script that fetched a payload). Anything that resolved during that window pulled it in;
  anything that waits a few days never sees it. Cargo's resolver can enforce the wait:

  ```toml
  # .cargo/config.toml — honored from Cargo 1.100 (nightly today; older cargo ignores it)
  [registry]
  global-min-publish-age = "3 days"
  [resolver]
  incompatible-publish-age = "deny"   # default once the age is set: skip too-fresh versions
  ```

  Versions already in `Cargo.lock` are unaffected, so a locked build stays reproducible; a
  patched advisory fix younger than the window is the one case to lower it deliberately
  (`cargo update -p <crate>` after checking the advisory), not to turn it off.

## Features
- Features are additive and must compose: any combination must compile. No mutually
  exclusive features without a compile_error guard.
- Don't put `default = ["everything"]`. Keep `default` minimal; let users opt in.
- Document non-obvious features in the crate docs.

## Metadata (for published crates)
- Required before publish: `description`, `license` (SPDX) or `license-file`,
  `repository`, `readme`, `keywords`, `categories`, `rust-version` (MSRV).
- `edition` set explicitly. `rust-version` reflects the real MSRV (verified in CI).
- `[package.metadata.docs.rs]` configured if features affect the docs build.

## Workspace
- Shared deps via `[workspace.dependencies]` and `dep.workspace = true` to keep
  versions unified. Shared lints via `[workspace.lints]`.

## Lints (workspace)
- Never `#![deny(warnings)]` in library code: a newly-stabilized lint then breaks
  every consumer's build. Set lint levels in the manifest and gate strictness in CI
  with `RUSTFLAGS="-D warnings"` (plus `cargo clippy --all-targets -- -D warnings`).
- `[workspace.lints.rust]`: `unsafe_op_in_unsafe_fn = "deny"`,
  `missing_docs = "warn"`, `unreachable_pub = "warn"`.
- `[workspace.lints.clippy]`: enable the broad groups at `warn` with a negative
  priority so specific overrides win —
  `pedantic = { level = "warn", priority = -1 }`,
  `nursery = { level = "warn", priority = -1 }` — then `allow` the noisy lints
  deliberately (e.g. `module_name_repetitions = "allow"`), each with a reason.
- Add `let_underscore_must_use = "warn"` explicitly. It is **restriction**-tier, so neither
  `pedantic` nor `nursery` turns it on, and `cargo clippy --all-targets -- -D warnings` passes
  a discarded validation clean — verified: `let _ = validate(n);` where `validate` returns
  `Result<(), E>` produces no diagnostic under the default gate, and is caught only once this
  lint is enabled. Any crate that validates by returning `Result` needs it, or the gate cannot
  see the one mistake that silently disables a check.
- Multi-crate workspaces: set `lto = "thin"` in the release profile (no cross-crate
  LTO by default). At 20+ crates, run `cargo hakari` to unify features and cut rebuilds.
- **`[lints.cargo]`** (stable from Cargo **1.100**; `-Zcargo-lints` on nightly before that):
  `unused_dependencies = "warn"` catches a dependency no target uses at `cargo check` time
  (the in-tree answer to `cargo shear`/`machete`), `missing_lints_inheritance` flags a
  workspace member that forgot `[lints] workspace = true`, and
  `text_direction_codepoint_in_{comment,literal}` deny Trojan-Source codepoints in the
  manifest by default. Declare them alongside the rustc/clippy tables; on an older
  toolchain they are inert, not an error.

## Hygiene
- Manifest comments state rationale, not process history: no plan/task IDs, phase
  markers, or review citations (`Cycle N`, `TODO(A-5)`, `PR #NNN review`) — write the
  invariant or constraint the gating serves, so the comment outlives the process that
  produced it.
