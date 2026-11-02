# Agent and skill refresh, November 2026

Scope: all 33 canonical agent briefs and 61 skill entry points, their frontmatter,
shared policy references and generated standalone bundles. This was a static inventory and
cross-reference audit with focused instruction review and selected behavioral scenarios;
it is not a claim that every agent/skill was exercised end to end on both hosts.

## Findings and changes

| Area | Finding | Change and evidence |
|---|---|---|
| Rust guidelines | Universal prescriptions obscured library/application and vendor-local constraints | [Source catalog](rust-guidelines.md); adoption, design and review now select a profile |
| API agents | Generic parameters and non-exhaustive types were prescribed without sufficient consumer context | API lead/designer, reviewer, builder and type rules now preserve caller semantics and existing public construction |
| Architecture | Traits at every seam and shared production/test constants could obscure the actual contract | Chief architect now requires a substitution need and independent test oracles |
| Async agents | Every await-held mutex was labeled defective | Async lead/runtime/concurrency and shared rules distinguish blocking guards from Tokio async guards |
| Verification | Fallback lint commands contradicted the project's actual configuration | Default-feature Clippy baseline plus applicable supported profiles; real project gates remain authoritative |
| Host routing | Inheritance claims and the eval force flag disagreed with current Claude behavior | [Routing](model-routing.md), roster, delegation, doctor, and eval environment corrected; regression fails before the force-flag repair |
| Optional tools | Documentation claimed plugins could not bundle MCP and tools always reached workers | Discover capabilities per worker; Firecrawl/Keenable/exa/host web are optional providers |
| Autonomy | Doctor asked again for repairs already authorized; solo active development was assumed for every repo | Reuse existing authorization; establish release status; distinguish self-review from independent acceptance |
| Research | Source discovery proposed modifying Cargo manifests | Read pinned cached/source revisions without dependency edits; distinguish facts from recommendations |
| Upstream workflow | Plan helper silently accepted invalid input and symmetric conflicts could stall readiness | [Pinned nick-vels study](upstream-nick-vels-2026-11.md); strict read-only graph validation and deterministic conflict-safe batches |

## Verification boundary

- Bun 1.4.4 in an isolated Ubuntu 24.04 checkout: 703 passed, 5 skipped, 0 failed.
  The five slop-audit integration checks require Cargo, absent in that Linux environment.
- Native Windows regressions passed for host envelopes, plan validation and model-force
  configuration. The full suite assumes Unix shell/path behavior; the Linux result is the
  full-suite evidence, not a claim of native Windows coverage for every test.
- Distribution validation: 61 skills, 5,580 description characters, 39 eval cases, version
  0.60.0. Prose, generated references and OpenAI metadata checks passed.
- agnix 0.52.1 strict: zero errors/warnings; one informational unpinned-tool-version notice.
- Claude plugin and marketplace strict manifest validation passed. Two model-backed Claude
  attempts returned the account's weekly limit, with no scores and $0.00 recorded spend.
  Do not treat those attempts as passes; no further Claude evals until the limit resets.
- Codex CLI 0.164.0 completed `guideline-applicability` and `review-guard-preservation`.
  Against the stored rubrics, manual assessment found all six guideline distinctions and
  all four guard/standards requirements in the answers; both returned `NEEDS WORK`.
  These were text-only runs with the current reviewer brief, review skill and relevant
  source documents supplied verbatim. No provider model or effort was overridden.
  This verifies selected instruction behavior, not plugin loading, independent-agent
  routing or statistical quality. Initial file-backed runs hit the child CLI's shell
  policy and are excluded from this result. Local traces and responses are under
  `.build/codex-evals-inline/` in the repository checkout.
- Host event behavior is covered by direct script/contract tests. Installing or reloading
  this revision into an interactive Codex/Claude session has not been verified.

## Inventory checked

Agents:

`api-design-lead`, `api-designer`, `async-runtime-specialist`, `async-systems-lead`, `build-engineer`, `chief-architect`, `cli-specialist`, `concurrency-specialist`, `database-specialist`, `dependency-manager`, `docs-engineer`, `embedded-specialist`, `error-architect`, `ffi-specialist`, `harsh-critic`, `macro-specialist`, `observability-engineer`, `perf-engineer`, `product-steward`, `qa-lead`, `release-lead`, `rust-build-resolver`, `rust-builder`, `rust-reviewer`, `rust-scout`, `security-auditor`, `slop-auditor`, `systems-perf-lead`, `test-engineer`, `tooling-lead`, `unsafe-auditor`, `wasm-specialist`, `web-framework-specialist`.

Skills:

`acceptance`, `add-dep`, `adopt`, `adr`, `api-review`, `architecture`, `audit-unsafe`, `bloat`, `brainstorm`, `changelog`, `ci-gate`, `commit`, `coverage`, `debug`, `deps-check`, `design-api`, `detect-stack`, `dev-task`, `doc-review`, `env-setup`, `eval-agents`, `evolve`, `fix-build`, `flaky-hunt`, `fuzz`, `grill-me`, `help`, `lint`, `memory-doctor`, `merge-conflicts`, `migrate`, `model-domain`, `msrv-check`, `mutants`, `new-crate`, `perf`, `pr`, `progress-bar`, `prose`, `prototype`, `publish`, `recall`, `refactor`, `remember`, `research`, `resolve-pr`, `review`, `scope-check`, `security-audit`, `session-wrap`, `spec`, `spec-tasks`, `spec-verify`, `start`, `studio-doctor`, `tdd`, `tech-debt`, `test-plan`, `test-setup`, `verify-loop`, `worktree-sweep`.
