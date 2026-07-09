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
- Multi-crate workspaces: set `lto = "thin"` in the release profile (no cross-crate
  LTO by default). At 20+ crates, run `cargo hakari` to unify features and cut rebuilds.
