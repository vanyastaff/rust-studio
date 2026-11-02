# Catalog migration audit

Date: 2026-11-02. Source release: 0.61.0; destination: 0.62.0.

## Naming and exposed inventory

The Agent Skills specification constrains syntax, length and directory agreement; it does
not prescribe a task taxonomy. Studio chooses imperative verb-object skill names and singular
agent role nouns. Anthropic recommends consistency and considers gerunds, while also accepting
action-oriented names. Sources: [Agent Skills specification](https://agentskills.io/specification)
and [Claude authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

The exposed inventory falls from 59 to 11 skills and from 33 to 5 agents. Old names remain
only as migration data or historical evidence; there are no installed alias entry points.
The machine-readable source of routing and invocation policy is `../../../catalog.json`.

## Capability disposition

Each former command maps to an operation under one outcome. Canonical procedures consolidate
shared lifecycle, diagnosis, review and verification steps; they are loaded only when needed.
The catalog records each operation's exact procedure. Forty procedures replace 59 complete
skill prompts; 22 reusable profiles hold domain checks without installing specialist personas.

| Current skill | Former capabilities |
|---|---|
| inspect-project | adopt, detect-stack, help, recall, start, studio-doctor |
| research-topic | research |
| design-change | architecture, design-api, grill-me, model-domain, prototype, spec, test-plan |
| implement-change | bloat, debug, dev-task, fix-build, flaky-hunt, merge-conflicts, perf, refactor, resolve-pr, tdd, verify-loop |
| review-work | api-review, audit-unsafe, deps-check, doc-review, memory-doctor, prose, review, scope-check, security-audit, tech-debt |
| verify-work | acceptance, coverage, fuzz, lint, msrv-check, mutants, spec-verify |
| write-docs | adr, changelog, remember, session-wrap |
| configure-tooling | ci-gate, env-setup, test-setup |
| maintain-project | add-dep, evolve, migrate, new-crate, worktree-sweep |
| maintain-studio | eval-agents, progress-bar |
| publish-change | commit, pr, publish |

## Agent disposition

Choose the role by the requested action, then load the needed profiles. The legacy map supplies
migration defaults, not permission to write or an exclusive domain owner. A different fresh
worker, with the correct context exclusions, establishes independent review or acceptance.

| Current role | Former roles |
|---|---|
| researcher | rust-scout |
| designer | chief-architect, product-steward, api-design-lead, api-designer, error-architect, async-systems-lead, systems-perf-lead, tooling-lead, release-lead |
| implementer | rust-builder, rust-build-resolver, build-engineer, test-engineer, docs-engineer, dependency-manager, async-runtime-specialist, concurrency-specialist, database-specialist, web-framework-specialist, ffi-specialist, embedded-specialist, wasm-specialist, macro-specialist, observability-engineer, perf-engineer |
| reviewer | rust-reviewer, harsh-critic, security-auditor, unsafe-auditor, slop-auditor, cli-specialist |
| verifier | qa-lead |

## What was removed or shared

- Removed tiered persona routing and duplicate coordinator scaffolding. The Elephant lifecycle,
  repair budget, task continuity and acceptance each retain one canonical contract.
- Merged repeated implementation, diagnostics and compiler-repair instructions into disclosed
  procedures. Optimization still requires comparable measurements; refactoring still preserves
  public behavior; tests still require meaningful evidence.
- Kept specialized API, async, systems, security, platform, data and other checks in profiles.
  Missing required profiles block the corresponding assessment.
- Kept publication, project maintenance and studio maintenance as three explicit-only entries.
  Only studio maintenance is plugin-only; ten entries have portable standalone bundles.
- Retained CLI review as read-only. Requested test/ledger authoring and disposable prototypes
  have scoped writers and separate independent evidence checks.
- Retained old task status, repair counts and provenance. Runtime resolution exposes the raw
  legacy label alongside its current destination, and usage reports preserve original events.
- Generated Codex agent retirement uses a content-hash ownership manifest. Unknown or modified
  definitions are preserved and reported; this change does not install into the user home.

## Size measurement

UTF-8 source bytes, measured before generated reference duplication. The baseline is the
in-session 0.61.0 source snapshot, including the preceding Elephant work.

| Source instructions | Before | After |
|---|---:|---:|
| Public skill entries | 387,273 | 23,465 |
| Role briefs plus domain profiles | 230,377 | 65,662 |
| Disclosed procedure text | included above | 153,588 |

These are inventory/source-size measurements, not measured inference tokens, latency or task
quality. Shared documentation, executable helpers, generated bundles and evaluation fixtures
are excluded. Validation and behavioral evidence are recorded in `verify-report.md`.
