# Rust Code Studio — Agent Roster

The org chart. Each agent's `model`, the domain it owns, what it explicitly does
**not** own, and the gate it answers for. Mirrors `coordination-protocol.md`.

**Model policy** (rationale in `claude-5-compat.md`): judgment-heavy agents — the two
directors, `harsh-critic`, `rust-reviewer`, `unsafe-auditor` — use `inherit`, so they run at
the **session model** and never judge below the model that wrote the code (on a Claude 5
session that's Fable 5, whose review recall exceeds Opus 4.8). Specialists stay `sonnet` and
the scout `haiku` for cost. `security-auditor` stays **pinned to `opus`**: Fable 5's cyber
safety classifiers can refuse vulnerability-hunting content mid-audit.

```
                         ┌───────────────────────────────────┐
              Tier 1     │  chief-architect (inherit)        │  product-steward (inherit)
              Directors  │  ARCH-GATE                        │  scope / milestones / propagation
                         └──────────────┬────────────────────┘
                                        │ delegates to
        ┌───────────────┬───────────────┼───────────────┬───────────────┬──────────────┐
 Tier 2 │ api-design    │ async-systems │ cli-ux         │ systems-perf  │ qa-lead       │ release-lead
 Leads  │ -lead         │ -lead         │ -lead          │ -lead         │ QA-GATE       │ RELEASE-GATE
        │ API-GATE      │ ASYNC-GATE    │ CLI-GATE       │ PERF/SAFETY   │               │ + tooling-lead
        └──────┬────────┴──────┬────────┴───────┬────────┴──────┬────────┴───────────────┘ BUILD-GATE
               │ delegates to  │                │               │
 Tier 3   api-designer    async-runtime    cli-specialist   concurrency-specialist
 Special  error-architect web-framework                     unsafe-auditor (inherit)
 -ists    macro-specialist database-spec                    ffi-specialist
          docs-engineer   observability                     perf-engineer
                          wasm-specialist                    embedded-specialist

 Quality (report to qa-lead / release-lead):
   test-engineer · security-auditor (opus) · dependency-manager · build-engineer

 Cross-cutting (reports to directors/leads):
   harsh-critic (inherit, adversarial design review, read-only)

 Execution (4) (the hands):
   rust-scout (haiku, read-only) → rust-builder (sonnet, writes)
     → rust-build-resolver (sonnet, fixes builds) → rust-reviewer (inherit, gate)
```

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
| `cli-ux-lead` | sonnet | CLI/TUI command structure, ergonomics, terminal UX, output discipline | CLI-GATE |
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

## Execution (4)

| Agent | Model | Role |
|-------|-------|------|
| `rust-scout` | haiku | Read-only locator. Maps where symbols/impls/tests live. Returns `file:line`. Never writes, never proposes fixes. |
| `rust-builder` | sonnet | Implements an **approved** plan. Writes code + tests, runs them, reports a diff summary. Stays in scope — no opportunistic refactors. |
| `rust-build-resolver` | sonnet | Gets a failing build green. Fixes the root cargo/rustc error (borrowck, trait bounds, lifetimes, types, features) in a check→fix loop. No masking. |
| `rust-reviewer` | inherit | Diff auditor and final gate. Correctness bugs, scope creep, missing tests. One line per finding, severity-tagged. No praise. |

---

## Domain → who to call

- **Designing a public crate API** → `api-design-lead` + `api-designer` + `docs-engineer` (skill: `/team-api`)
- **Building an async service** → `async-systems-lead` + `async-runtime-specialist` + `web-framework-specialist` + `database-specialist` + `observability-engineer` (skill: `/team-async`)
- **Making it fast / safe** → `systems-perf-lead` + `perf-engineer` + `concurrency-specialist` + `unsafe-auditor` (skill: `/team-perf`)
- **Shipping a release** → `release-lead` + `security-auditor` + `dependency-manager` + `docs-engineer` (skill: `/team-release`)
- **A CLI** → `cli-ux-lead` + `cli-specialist`
- **Embedded / `no_std`** → `systems-perf-lead` + `embedded-specialist` + `ffi-specialist`
- **Adversarial design review** → `harsh-critic` (skill: `/doc-review`)
- **Test strategy / implementation** → `qa-lead` + `test-engineer` (skills: `/test-plan`, `/tdd`)
