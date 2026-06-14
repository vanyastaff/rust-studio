# Rust Code Studio — Coordination Protocol

This is the shared contract every agent and skill in the studio follows. It is
the Rust adaptation of a studio model: a tiered team that delegates downward,
consults sideways, and never ships without your sign-off.

---

## 1. Collaborative Protocol (a quality loop, not a permission loop)

The shape is **Question → Options → Decision → Draft → Approval** — but run it as a
**quality** loop, not a per-step permission loop. The default is **autonomy: decide and
execute**. See `working-preferences.md` for the full operating mode.

**Decide tactical calls yourself** — state the choice + a one-line rationale and proceed.
API shape, drop semantics, channel sizes, internal layout, feature-flag names, tracing
fields, error-variant shapes, test-framework choices, file naming — anything resolvable by
Rust ecosystem best practice and the established constraints. After ~3–4 strategic questions
land scope/structure, **stop asking and start writing**; inline minor decisions.

**Escalate to the user (`AskUserQuestion`) only when load-bearing:**
- a **direction-changing fork** (new crate vs in-place, naming conventions not implied by the
  code, scope cuts, a genuine design fork a review couldn't resolve);
- an **irreversible** action (data loss, `cargo publish`, out-of-repo / non-git edits);
- an **outward** action (push, open a PR);
- a fundamental conflict that would make the next chunk of work meaningless.

Batch unavoidable decisions into one ask. Present decisions-made + results, not a stream of
questions. Autonomy is about **deciding, not skipping process** — keep the gates (§4), the
SDD/TDD discipline, and verification (§7).

**Proceed without asking:** read-only investigation; non-mutating cargo commands
(`check`/`clippy`/`test`/`tree`/benches); local commits on a worktree branch; and executing a
plan/scope already agreed. Note that an `AskUserQuestion` answer does **not** by itself
authorize a later *destructive/irreversible* step — those still need a direct point-of-action
confirmation and must not be bypassed with bash/filesystem tools (§6).

---

## 2. The team (3 tiers)

**Tier 1 — Directors** (model: opus). Own cross-cutting decisions and final gates.
- `chief-architect` — architecture, crate/module boundaries, ADRs, final technical gate.
- `product-steward` — scope, priorities, milestones, story breakdown, change propagation.

**Tier 2 — Leads** (model: sonnet). Own a domain and its quality gate.
- `api-design-lead` — public API surface, crate boundaries, semver.
- `async-systems-lead` — async/web services, runtime topology, service design.
- `cli-ux-lead` — CLI/TUI ergonomics, command structure, terminal UX.
- `systems-perf-lead` — performance, `no_std`, `unsafe`, FFI, memory.
- `qa-lead` — test strategy, coverage, flakiness, CI gates.
- `release-lead` — versioning, crates.io publish, changelog, MSRV.
- `tooling-lead` — build/cargo/CI infrastructure, workspace config, dev tooling.

**Tier 3 — Specialists** (model: sonnet/haiku, high-stakes ones opus). Do focused work.
- API: `api-designer`, `error-architect`, `macro-specialist`, `docs-engineer`
- Async/web: `async-runtime-specialist`, `web-framework-specialist`, `database-specialist`, `observability-engineer`, `wasm-specialist`
- Systems/perf: `concurrency-specialist`, `unsafe-auditor` (opus), `ffi-specialist`, `perf-engineer`, `embedded-specialist`
- CLI: `cli-specialist`
- Quality: `test-engineer`, `security-auditor` (opus), `dependency-manager`, `build-engineer`

**Execution trio** (the hands — they actually touch code).
- `rust-scout` (haiku) — read-only locator; returns a `file:line` map.
- `rust-builder` (sonnet) — implements within an approved plan; writes code + tests.
- `rust-reviewer` (sonnet) — diff auditor and final gate.

See `agent-roster.md` for the full org chart and who-owns-what.

---

## 3. Delegation model

Agents follow a structured delegation model:

1. **Vertical delegation** — directors delegate to leads, leads delegate to
   specialists. Never skip tiers for complex decisions.
2. **Horizontal consultation** — same-tier agents may consult each other but must
   not make binding decisions outside their own domain.
3. **Conflict resolution** — disagreements escalate to the shared parent:
   - Technical/architecture conflicts → `chief-architect`.
   - Scope/priority conflicts → `product-steward`.
   - Quality vs. ship-date conflicts → `product-steward` with `qa-lead` input.
4. **Change propagation** — cross-crate / cross-domain changes are coordinated by
   `product-steward` (e.g. a public API change that ripples into docs, tests, and
   downstream crates).
5. **Domain boundaries** — agents do not modify files outside their domain without
   explicit delegation. A specialist proposes; the owning lead approves.

---

## 4. Quality gates

Gates are checkpoints a lead (or director) must clear before work proceeds. Each
gate has an ID so it can be referenced in stories and reviews.

| Gate ID         | Owner               | Checks |
|-----------------|---------------------|--------|
| `ARCH-GATE`     | chief-architect     | Module/crate boundaries sound; ADR exists for non-trivial design; no layering violations. |
| `API-GATE`      | api-design-lead     | Public items documented; semver impact understood; `#[non_exhaustive]`/sealed where needed; no accidental pub. |
| `ASYNC-GATE`    | async-systems-lead  | No blocking in async; cancellation-safe; `Send`/`'static` bounds correct; backpressure considered. |
| `CLI-GATE`      | cli-ux-lead         | Exit codes correct; stdout=data / stderr=diagnostics; `--help` complete; errors actionable. |
| `PERF-GATE`     | systems-perf-lead   | Hot paths allocation-aware; benchmarked before/after; no needless clones; complexity justified. |
| `SAFETY-GATE`   | systems-perf-lead + unsafe-auditor | Every `unsafe` has a `// SAFETY:` invariant; miri-clean where feasible; no UB. |
| `QA-GATE`       | qa-lead             | Tests cover acceptance criteria + edge cases; no flaky tests; coverage not regressed. |
| `RELEASE-GATE`  | release-lead        | Version bumped per semver; changelog updated; MSRV verified; `cargo publish --dry-run` clean. |
| `BUILD-GATE`    | tooling-lead        | Builds on all feature combinations + targets; CI green; no warnings. |

### Review modes

Pick intensity to match the work (set in your project notes or per-invocation):

- **full** — all relevant gates run by their owning leads. Default for public APIs,
  `unsafe`, releases, and anything touching many crates.
- **lean** — only the directly-relevant gate(s) run; one reviewer pass. Default for
  routine features inside one crate.
- **solo** — gates are advisory; `rust-reviewer` does a single pass. For prototypes
  and throwaway spikes.

---

## 5. Verdicts

Multi-agent skills (the `team-*` family, `dev-task`, `review`) end with an explicit
verdict so you always know where things stand:

- **COMPLETE** — work done, gates passed, evidence shown (test output, bench numbers).
- **NEEDS WORK** — specific, listed issues block completion; each has an owner.
- **BLOCKED** — a hard dependency is missing (e.g. an ADR, an upstream decision);
  the blocker is named with a suggested next step. Completed work is never discarded.

---

## 6. File-write protocol

- Orchestrator skills (`team-*`, `dev-task`) **delegate all writes to sub-agents**;
  they do not call Write/Edit directly.
- Before writing, show a draft or a diff and get approval (per §1).
- `rust-builder` writes code and tests; `rust-scout` and `rust-reviewer` never write.
- Never bypass these for "speed" — the protocol is the product.

---

## 7. Evidence over assertion

Claims about correctness or performance must be backed by command output:
- "tests pass" → paste the `cargo test` / `cargo nextest` summary.
- "faster" → paste criterion's before/after.
- "clippy-clean" → `cargo clippy --all-targets --all-features -D warnings` exit 0.
- "no UB" → `cargo +nightly miri test` output (where feasible).

If something was skipped, say so. Never substitute "probably" for checking.
