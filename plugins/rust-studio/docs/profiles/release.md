# Release readiness

Use for versioning, changelogs, MSRV, packaging and publish order. Read
`${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md`; load `api.md`, `documentation.md`,
`dependencies.md` and `security.md` for their required release evidence.

Derive patch/minor/major from the public API diff and cargo semver-checks against the previous
release, including manual compatibility hazards. Determine dependency-topological workspace
publish order. Verify each rust-version against its actual toolchain and CI, including
cargo hack --rust-version where suitable. Draft user-facing changes and migration guidance.

## RELEASE-GATE

Version changes match the compatibility verdict; changelog and consumer docs agree; MSRV
is verified; manifest metadata and `cargo publish --dry-run` pass for each crate in order;
security and dependency evidence are complete. Report per-crate commands and outputs.
Gate readiness is not publishing authority: actual publish requires explicit authorization
for the named crates and release. Preserve existing authorization, but do not infer it from
a role, profile, mode flag or a successful dry-run.
