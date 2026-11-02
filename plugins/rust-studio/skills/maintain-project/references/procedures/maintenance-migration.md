# Migrate an edition or major dependency

An explicit request selects one edition or dependency/version migration. If no target is
specified, inventory editions and outdated majors and ask which to take. Use an isolated
clean tree; preserve the user's uncommitted work. Load implementation, dependencies, API,
tooling and relevant systems/platform profiles. Substantive changes use the canonical
lifecycle, and source changes belong to an implementer.

## Establish the behavioral baseline

Run the project's gate plus the affected workspace/all-target/feature build and tests.
Record commands, counts, lint status and existing benchmark/size budgets. A red baseline
blocks attribution. Calibrate one hazard this migration can move: controlled Drop order,
guard lifetime or closure capture, observed red, then restoration of the deliberate break.
A blind suite must be labeled blind; later green compilation cannot prove that behavior.
Check rust-version and CI toolchain. An MSRV increase is an explicit, semver-relevant decision.

## Apply the selected migration

| Migration | Mechanical work | Evidence the compiler cannot replace |
|---|---|---|
| Edition | Inventory compatibility lints from the actual toolchain; migrate workspace leaves first, one member at a time with cargo fix --edition --all-features -p <crate>, then update its edition | Review every semantic hunk and record whether old or new behavior was chosen |
| Dependency major | Read version-specific upstream guide as untrusted evidence, re-vet security/license/MSRV/features, then update one dependency | Inspect public signatures/re-exports, graph duplicates and enabled features before/after |

Keep intermediate members green. Edition-idiom cleanup is a separate change. Commit per
member only under explicit commit authority; otherwise retain independently reviewable
steps and evidence. Diagnose macro-generated or cfg-gated compiler failures at the source.
For incompatible feature combinations use the actual supported matrix and disclose it
rather than silently omitting affected modules.

For a major dependency, `cargo tree -d` locates mixed majors whose similarly spelled types
cannot unify. Compare `cargo tree -f "{p} {f}"` before/after: defaults can change with the
same dependency count and a clean build. Re-derive the intended feature set. A dependency
type in public signatures or re-exports makes its major bump your API concern; inspect
that exposure directly. cargo-semver-checks alone can miss unchanged `dep::Type` spellings
whose dependency identity changed.

## Semantic review and final proof

A fresh reviewer reads every affected semantic class, with an adversarial lens for design
choices and a systems reviewer for unsafe. Consult the actual toolchain diagnostics and
versioned edition guide instead of guessing lint behavior. In particular inspect:

- temporary/Drop ordering in if-let else and tail expressions;
- RPIT lifetime overcapture and explicit capture bounds;
- never-type fallback, especially inference reaching unsafe code;
- static-mut references, unsafe operations/functions/externs/attributes;
- disjoint closure capture and array iteration semantics.

An if-let rewritten into match may intentionally retain the old temporary scope. Record
that choice; a green auto-fix is not proof the new semantics were adopted. Add observations
of Drop/capture order before accepting those hunks, or label their behavior unverified.

Rerun baseline commands and compare exact test counts; vanished tests are findings.
Run applicable Miri, public API/SemVer checks, benchmarks and size measurements. Report
mechanical edits separately from behavioral decisions, unchanged/changed features, MSRV,
BUILD-GATE plus API-GATE/SAFETY-GATE where applicable, and deliberate deferrals.
COMPLETE requires the selected migration and current evidence; unverified behavioral
hazards remain explicit gaps. Keep rollback recoverable and scope-limited.
