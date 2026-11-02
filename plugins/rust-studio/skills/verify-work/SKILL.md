---
name: verify-work
description: "Verify Rust acceptance, test strength, fuzz campaigns, lint gates, and minimum compiler support with executable evidence."
---

# Verify work

Default effect: checks and their evidence artifacts. Running a check does not authorize
production repair. Use `references/project-gate.md` for the project's actual commands and
feature/environment matrix, and `references/integrity-and-evidence.md` for evidence and
denominators. Report unavailable tools or targets as unverified.

## Steps

1. Select `--mode <mode>` from the requested action (natural-language requests may infer it).
   State the target tree, scope, budget and required output. Read the selected
   procedure below. Resolve spec slugs across both supported roots without copying artifacts;
   competing matches require an explicit path.
2. Separate checking from explicitly requested authoring. The coordinator may author a requested
   ledger or verification report. An implementer may author requested tests or fuzz targets in
   declared paths; that assignment does not include production fixes. A different fresh verifier
   judges the resulting evidence. Choose roles by action and load applicable profiles, rather
   than treating a domain profile as an execution permission.
3. The coordinator runs checks that persist ledger evidence or maintained artifacts and records
   their outputs. A verifier stays read-only, judges supplied evidence independently, and may
   rerun non-mutating checks with ordinary build/cache output. Retain commands, exclusions,
   failures and source identity. Use `references/delegation.md` and `references/sub-agents.md`
   for dispatch and host limitations; an inline pass cannot claim independent verification.
4. Return the measurements and COMPLETE / NEEDS WORK / BLOCKED under
   `references/verdicts.md`. Required unverified checks prevent COMPLETE. Production failures
   return to authorized `implement-change` work under `references/review-repair.md`, preserving
   repair history; recheck affected evidence after repair.

| Mode | Requested outcome | Procedure |
|---|---|---|
| `ledger` | Inspect, lint, author, run or reverify checker-decided criteria | `references/procedures/verification-acceptance.md` |
| `acceptance` | Verify a spec and original request; `--blind` explicitly requires independent acceptance | `references/procedures/verification-acceptance.md` |
| `coverage` | Measure executed behavior and optionally author requested gap tests | `references/procedures/verification-tests.md` |
| `fuzz` | Bounded campaigns and requested targets or minimized regression tests | `references/procedures/verification-tests.md` |
| `mutation` | Grade assertions and optionally author requested stronger tests | `references/procedures/verification-tests.md` |
| `lint` | rustfmt and clippy against the actual project gate | `references/procedures/verification-toolchain.md` |
| `minimum-rust` | Measured compiler floor and dependency contribution | `references/procedures/verification-toolchain.md` |

## When NOT this skill

- Decide which behaviors require tests: use `design-change` in `tests` mode.
- Diagnose or drive failures green, including requested `--fix`: use `implement-change`.
- Audit code, design decisions or prose: use `review-work`.
- Install tools or change test/CI configuration: use authorized `configure-tooling` work.
- Commit a regression test, file an issue or release: those are separate outward actions;
  suggest explicit `publish-change` when appropriate. Test authoring does not authorize them.
