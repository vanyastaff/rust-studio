# Set up project test tooling

Inspect workspace members, existing tests/benches, fixtures, dev-dependencies, profiles,
nextest and coverage configuration. Identify the actual configuration location before
editing; preserve a project-specific path and runner wiring. Load
`references/profiles/testing.md`, `references/testing.md` and `references/perf.md`.

Resolve target crates, optional snapshots, coverage threshold and coverage command location
from the request and repository. Ask only for choices that remain user-owned. A setup audit
stops at its inventory. An installation request authorizes the scoped harness/configuration
changes, not unrelated feature or production repairs.

Create one plan naming dev-dependencies (proptest, criterion and optionally insta), nextest
timeouts/threads/retry policy, coverage format and threshold flags, integration-test and
benchmark paths, shared strategies/fixtures, and any profile overrides. Use the existing
project conventions rather than impose a directory layout. Distinguish test placeholders
from tests that establish feature acceptance.

Assign an implementer explicit configuration/test paths. It merges the selected dependencies,
nextest profile, integration and Criterion harnesses, required bench profile, and a reproducible
cargo-llvm-cov command in the existing CI helper or cargo alias. Keep retries visible so they
cannot conceal intermittent failures. Respect workspace feature resolution: use
`cargo nextest run --workspace -E 'package(<crate>)'` for scoped workspace execution rather
than a package-only build that omits siblings (`references/large-workspace.md`).

Run `cargo check --tests --benches` and the project's actual gate from
`references/project-gate.md`. Where no project gate exists, run nextest (cargo test fallback)
and clippy with warnings denied, accounting for doctests separately. Preserve output and
scoped repair history under `references/review-repair.md`.

A fresh verifier with the testing profile judges QA-GATE: harnesses compile, nextest actually
discovers the intended tests, ignores have tracking justification, proptest/Criterion usage
matches project conventions, and the coverage invocation is reproducible. Measurement of an
empty scaffold cannot establish feature coverage. A separate tooling lens checks CI changes
when required (`references/sub-agents.md`). Authorship is not independent verification.

Report versions, changed files, profile and coverage command, discovery evidence, results
and COMPLETE / NEEDS WORK / BLOCKED. Missing tools, unsupported feature combinations or
unresolved criteria stay explicit. Preserve completed work and resolve prerequisites within
existing authority; dropping a requested capability requires a stated scope decision.
