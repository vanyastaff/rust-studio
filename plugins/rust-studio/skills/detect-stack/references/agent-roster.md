# Rust Code Studio — Agent Roster

The org chart. Each agent's `model`, the domain it owns, what it explicitly does
**not** own, and the gate it answers for. Mirrors `coordination-protocol.md`.

**Model policy** (rationale in `claude-5-compat.md`): the judgment-heavy agents (the two
directors, `harsh-critic`, `rust-reviewer`, `unsafe-auditor`, `slop-auditor`) use `inherit`, so
they run at the **session model** and never judge below the model that wrote the code. Specialists stay
`sonnet` and the scout `haiku` for cost. `security-auditor` stays **pinned to `opus`** so that
a cyber-classifier trip falls back inside the audit instead of switching the whole session.
**No agent pins `effort`** — every one of them inherits the session's level, which is what
makes effort the user's dial rather than the roster's.

These labels are routing classes. Claude Code resolves them through its model aliases; a gateway
maps those aliases to its own available models. Codex uses the optional local routing file from
`model-routing.md`. Provider IDs never belong in these shared agent briefs.

```
                         ┌───────────────────────────────────┐
              Tier 1     │  chief-architect (inherit)        │  product-steward (inherit)
              Directors  │  ARCH-GATE                        │  scope / milestones / propagation
                         └──────────────┬────────────────────┘
                                        │ delegates to
        ┌───────────────┬───────────────┼───────────────┬──────────────┐
 Tier 2 │ api-design    │ async-systems │ systems-perf  │ qa-lead       │ release-lead
 Leads  │ -lead         │ -lead         │ -lead          │ QA-GATE       │ RELEASE-GATE
        │ API-GATE      │ ASYNC-GATE    │ PERF/SAFETY   │               │ + tooling-lead
        └──────┬────────┴──────┬────────┴───────┬────────┴──────┬────────┴───────────────┘ BUILD-GATE
               │ delegates to  │                │               │
 Tier 3   api-designer    async-runtime    cli-specialist (CLI-GATE)   concurrency-specialist
 Special  error-architect web-framework                     unsafe-auditor (inherit)
 -ists    macro-specialist database-spec                    ffi-specialist
          docs-engineer   observability                     perf-engineer
                          wasm-specialist                    embedded-specialist

 Quality (report to qa-lead / release-lead):
   test-engineer · security-auditor (opus) · dependency-manager · build-engineer

 Cross-cutting (reports to directors/leads):
   harsh-critic (inherit, adversarial design review, read-only)
   slop-auditor (inherit, tree-level slop ledger, read-only)

 Execution (4) (the hands):
   rust-scout (haiku, read-only) → rust-builder (sonnet, writes)
     → rust-build-resolver (sonnet, fixes builds) → rust-reviewer (inherit, gate)
```

---

## Who can write

Tool access is not a detail of the brief — it is the roster's load-bearing split. **Directors and
leads never write.** They decide, hold a gate, and delegate; all nine declare
`disallowedTools: Write, Edit, NotebookEdit`, as do the six read-only auditors
(`rust-reviewer`, `harsh-critic`, `rust-scout`, `unsafe-auditor`, `security-auditor`,
`slop-auditor`) — 14 of 33.

Implementation belongs to `rust-builder` and `rust-build-resolver`, plus the Tier-3 specialists
whose briefs say they implement — `test-engineer`, `build-engineer`, `docs-engineer`,
`cli-specialist`, `dependency-manager`, `perf-engineer` and `observability-engineer` (the last
two edit the code they measure and instrument, by design).

The rule this enforces: **an agent that can write is never a review lens.** A review that edits
the tree it audits destroys the artifact under review — it races the verification run and, on
uncommitted work, leaves no recovery point. `RS-AGENT-083` fails the build if `/review` ever
names a write-capable agent again; the domain checklist a specialist would have carried is
carried by `rules/<domain>.md`, read by the lens that owns the gate.

---

## Tier 1 — Directors

| Agent | Model | Owns | Does NOT own | Gate |
|-------|-------|------|--------------|------|
| `chief-architect` | inherit | Crate/module boundaries, layering, ADRs, tech-stack decisions, final technical sign-off | Scope/priority (product-steward), domain implementation details | ARCH-GATE |
| `product-steward` | inherit | Scope, milestones, story breakdown, prioritization, cross-domain change propagation | Technical design (chief-architect), code quality (qa-lead) | SCOPE-GATE |

## Tier 2 — Leads

| Agent | Model | Owns | Gate |
|-------|-------|------|------|
| `api-design-lead` | sonnet | Public API surface, crate boundaries, semver discipline, re-exports | API-GATE |
| `async-systems-lead` | sonnet | Async architecture, runtime topology, service design, web stack choices | ASYNC-GATE |
| `systems-perf-lead` | sonnet | Performance budgets, `no_std`, `unsafe` policy, FFI, memory model | PERF-GATE, SAFETY-GATE |
| `qa-lead` | sonnet | Test strategy, coverage targets, flakiness, CI gates | QA-GATE |
| `release-lead` | sonnet | Versioning, crates.io publishing, changelog, MSRV policy | RELEASE-GATE |
| `tooling-lead` | sonnet | Build scripts, workspace config, CI matrix, cross-compilation, dev tooling | BUILD-GATE |

## Tier 3 — Specialists

| Agent | Model | Focus |
|-------|-------|-------|
| `api-designer` | sonnet | Trait design, type-state, builders, sealed traits, newtypes, `From`/`TryFrom` |
| `error-architect` | sonnet | Error taxonomy, `thiserror`/`anyhow`, `Result` discipline, error context |
| `macro-specialist` | sonnet | proc-macros (`syn`/`quote`), `macro_rules!`, hygiene, derive macros |
| `docs-engineer` | sonnet | rustdoc, doc-tests, intra-doc links, `mdBook`, examples, README |
| `async-runtime-specialist` | sonnet | tokio, cancellation, `select!`, streams, `Send`/`'static` bounds, spawning |
| `web-framework-specialist` | sonnet | axum/actix, extractors, middleware, tower, routing, state |
| `database-specialist` | sonnet | sqlx/diesel/sea-orm, migrations, pools, transactions, query perf |
| `observability-engineer` | sonnet | `tracing`, spans, metrics, structured logs, OpenTelemetry |
| `wasm-specialist` | sonnet | `wasm-bindgen`, `wasm32` targets, JS interop, binary size |
| `concurrency-specialist` | sonnet | `Send`/`Sync`, atomics, lock-free, `loom`, channels, data races |
| `unsafe-auditor` | inherit | `unsafe` review, `// SAFETY:` invariants, miri, UB, aliasing, provenance |
| `ffi-specialist` | sonnet | `bindgen`/`cbindgen`, C ABI, `no_std`, `extern "C"`, repr |
| `perf-engineer` | sonnet | criterion, flamegraph, `perf`, cachegrind, SIMD, allocation profiling |
| `embedded-specialist` | sonnet | `no_std`, `embedded-hal`, cortex-m, interrupts, `#[no_main]`, panics |
| `cli-specialist` | sonnet | clap derive, ratatui, shell completions, exit codes, signal handling |
| `test-engineer` | sonnet | proptest, criterion, nextest, fixtures, integration tests, golden tests |
| `security-auditor` | opus | `cargo-audit`, RUSTSEC, secrets, input validation, supply chain, deserialization |
| `dependency-manager` | sonnet | `cargo-deny`, feature unification, MSRV, version conflicts, bloat |
| `build-engineer` | sonnet | `build.rs`, workspace layout, cross-compilation, CI matrix, feature combos |
| `harsh-critic` | inherit | Adversarial critic. Attacks designs/specs/plans — challenges the premise, builds failure scenarios, proposes alternatives. No praise, no fixes (read-only). |
| `slop-auditor` | inherit | Tree-level slop ledger: duplicated functions/types (`similarity-rs`), orphan files and module cycles (`cargo modules`), dead `pub`, unused deps, untyped model calls, naming/pattern/boundary tells. Fingerprinted findings with a reshape each; no fixes (read-only). |

## Execution (4)

| Agent | Model | Role |
|-------|-------|------|
| `rust-scout` | haiku | Read-only locator. Maps where symbols/impls/tests live. Returns `file:line`. Never writes, never proposes fixes. |
| `rust-builder` | sonnet | Implements an **approved** plan. Writes code + tests, runs them, reports a diff summary. Stays in scope — no opportunistic refactors. |
| `rust-build-resolver` | sonnet | Gets a failing build green. Fixes the root cargo/rustc error (borrowck, trait bounds, lifetimes, types, features) in a check→fix loop. No masking. |
| `rust-reviewer` | inherit | Diff auditor and final gate. Correctness bugs, scope creep, missing tests. One line per finding, severity-tagged. No praise. |

---

## Domain → who to call

- **Designing a public crate API** → `/dev-task`, then `api-design-lead` when the public contract changes
- **Building an async service** → `/dev-task`, then the async, web, database, or observability specialist the task needs
- **Making it fast / safe** → `/perf` or `/dev-task`, then `systems-perf-lead` and the relevant safety specialist
- **Shipping a release** → `/publish`, adding release, security, dependency, and docs review as needed
- **A CLI** → `cli-specialist`
- **Embedded / `no_std`** → `systems-perf-lead` + `embedded-specialist` + `ffi-specialist`
- **Adversarial design review** → `harsh-critic` (skill: `/doc-review`)
- **An inherited or AI-authored tree** → `slop-auditor` (skills: `/adopt`, `/tech-debt`, `/refactor`)
- **Test strategy / implementation** → `qa-lead` + `test-engineer` (skills: `/test-plan`, `/tdd`)
