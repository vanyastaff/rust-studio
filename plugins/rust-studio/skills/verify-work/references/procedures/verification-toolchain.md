# Lint and minimum Rust verification

Use `references/profiles/tooling.md`, `references/profiles/release.md` and
`references/cargo-manifest.md`. Check mode leaves source, manifests and CI unchanged.
Read-only here permits ordinary build output; it does not permit rewriting the gate.
If a project recipe regenerates maintained files, the verifier reports that effect and leaves
execution of that artifact-producing step to the authorized coordinator or implementer. It may
rerun the non-mutating checks and independently inspect the resulting evidence.

## Lint

Read the actual project gate recipe under `references/project-gate.md`, including every
invocation, feature set and environment. All-features is not a superset of default-feature
lint coverage. Without a project gate run `cargo fmt --all --check` and
`cargo clippy --all-targets -- -D warnings`, respecting rustfmt configuration.

Group findings by lint and distinguish genuine issues from demonstrated false positives.
Return commands, exit codes and relevant output. A --fix request belongs to implement-change:
safe formatting and clippy fixes operate only in authorized scope, retain unrelated dirty work,
and rerun the original gate. False-positive allows must be scoped and justified; a real lint
requires fixing its cause. `references/core.md` governs suppression and workspace lint policy.
End COMPLETE / NEEDS WORK / BLOCKED; a failed gate never starts automatic production repair.

## Minimum Rust

Read every relevant manifest, inherited workspace.package rust-version, direct/dev/build
dependencies and CI pins. State the supplied target floor or auto-detection scope. Prefer
`cargo msrv find --output-format json` where installed; otherwise use installed toolchains to
bisect cargo +<version> check across applicable features/targets. Start at the declared version
or a stated candidate when unset. Preserve manifests and lockfile during probing; isolate any
tool that rewrites them. Missing toolchains or unsupported targets limit the proven interval.

Inspect resolved dependency metadata and feature graph, including transitive dependencies;
--no-deps metadata cannot establish external dependency MSRVs. Verify published requirements
against primary crate sources where metadata is absent. Report declared, measured, dependency-
driven and effective floors, with versions, profiles, raw output and unavailable probes.

When the declaration differs, price compatibility before recommending a change: consumers
dropped by a raised floor and the actual newer APIs/idioms the crate would gain. Compare
updating rust-version, compatible dependency pins or an explicit investigation-only outcome.
Known drift remains a compatibility finding even if documented. A check request does not edit
manifests. Requested changes continue through implement-change/configure-tooling with exact
manifest/CI scope, rerun at the chosen floor and the stable project lint gate.

Report declared before/after if changed, effective floor, responsible dependencies, MSRV check,
stable lint, CI coverage and RELEASE-GATE status for MSRV. Passing this component does not
clear unrelated release requirements. End COMPLETE / NEEDS WORK / BLOCKED with missing
prerequisites and retained findings.
