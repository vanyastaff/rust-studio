# Scaffold a Rust crate

The explicit scaffold request authorizes the stated file set. Infer name, lib/bin, domain,
MSRV, license and workspace membership from the request and repository; batch only missing
crate-defining choices. Default type is lib and license MIT OR Apache-2.0. Use edition 2024
with its Rust 1.85 floor unless project constraints require a decision. Report material
defaults before writing and preserve existing root configuration.

Read `references/cargo-manifest.md`, `references/core.md`, `references/build-scripts.md`
and the applicable API/async/CLI/systems/platform profiles. Select a small domain-appropriate
dependency set and disclose features: library errors may use thiserror; async defaults are
Tokio full and tracing, with tracing-subscriber for development; CLI parsing uses clap
derive and tracing with optional color-eyre; systems has none by default. Adjust these
defaults to actual domain/target needs and workspace policy and state the choice. Additions
beyond the disclosed scaffold scope need their own explicit dependency choice.

Assign the file set to an implementer:

- Cargo.toml: name/version 0.1.0/edition/license, requested rust-version, description,
  repository metadata, keywords/categories, workspace-compatible lint inheritance or
  explicit Rust/clippy lints, dependencies/dev-dependencies, relevant feature declarations.
- src/lib.rs or src/main.rs: documented minimal entry; library lint attributes and forbid
  unsafe where suitable, systems/no_std shape when requested, CLI error setup when selected.
- Reuse existing deny/toolchain/CI policy; for a standalone crate create deny.toml with
  advisory/license/duplicate policy, a stable rust-toolchain.toml with fmt/clippy, minimal
  profile for systems, and a CI stub running check/lint/tests/fmt with required tools installed.
- README.md from `references/templates/crate-readme.md`, with license and requested MSRV.
- For workspace membership, add only the new path and reuse workspace dependency/lint policy.

Run package check and all-target clippy with warnings denied, formatting and the applicable
workspace gate; ensure a selected optional dependency is reflected in the source/features.
Report files, actual outputs and workspace membership. COMPLETE means the disclosed scaffold
compiles and integrates. Preserve successfully written files if a prerequisite blocks a
check; do not silently omit the CI stub or another requested artifact to report completion.
