# Audit or install CI gates

Read `references/ci-best-practices.md`, `references/project-gate.md` and the tooling profile.
Inspect the existing gate recipes, workspace lints, clippy configuration, nextest, lefthook
and CI jobs. The project-owned gate remains authoritative. Integrate missing checks into
its commands, feature sets and environment rather than creating a parallel unused gate.

An empty or audit request is read-only. Report each mechanism as present, missing or weakened:

| Failure | Required control |
| --- | --- |
| Direct clocks or blocking sleeps in library logic | clippy disallowed_methods under `-D warnings`, adapted to sync/async boundaries |
| Deadlocks, huge durations or hung tests | nextest slow-timeout with terminate-after |
| Suspicious large literal sleeps outside tests | the template's source smell check |
| Hung CI jobs | job timeout-minutes |
| Unexplained lint suppression | allow_attributes_without_reason deny |
| Removed bans or raised thresholds that mask defects | check-gate integrity assertions in local hooks and CI |
| Accidental unreachable public surface | unreachable_pub, with conflicting redundant_pub_crate policy reconciled |

Check member-crate overrides, bare allows and missing/raised timeouts as well as root files.
Audit-only ends with findings and their path evidence.

For an authorized install or repair, produce the intended merged changes and state threshold
choices before applying them. Resolve only missing scope or consequential policy choices.
Use `references/templates/` for clippy.toml, workspace-lints.toml, nextest.toml, lefthook.yml,
scripts/check-gate.sh and ci-anti-hang.yml; load deny.toml/dependabot.yml where requested.
Check current community guidance in `references/ci-best-practices.md` before extending the
anti-hang core, including jonhoo/rust-ci-conf. Retain relevant MSRV, SemVer, dependencies,
security and coverage checks through their canonical review/verification procedures.

An implementer merges the approved scope into existing files, enables workspace lint
inheritance in members, installs the executable integrity helper and wires CI consumers.
Use the actual nextest configuration path, normally `.config/nextest.toml`. CI uses prebuilt
installation actions rather than cargo install; local tools prefer cargo binstall. SHA-pin
third-party actions. Use supported toolchain/cache/install actions, a separate
`cargo test --doc` step because nextest omits doctests, and a deny.toml schema supported by
the installed tool. Preserve existing configuration unrelated to this request.

Verify the project's gate, clippy with warnings denied, `bash scripts/check-gate.sh` producing
`gate intact`, and `cargo nextest run --profile ci`. Run authorized lefthook checks when
installed and disclose any not run. A fresh verifier with the tooling profile assesses
BUILD-GATE evidence. New red source checks are findings: repair source only under authorized
scope through `/implement-change`, retaining repair history. Never weaken checks to pass.

Report command output and COMPLETE / NEEDS WORK / BLOCKED. Record remaining protections
such as gate-path CODEOWNERS review without claiming they are configured. Every changed
threshold or suppression must retain an explicit rationale for review.
