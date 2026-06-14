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
