# Rust Code Studio — usage guide

How the plugin works and how to drive it. For the bare catalog run `/help`; for who-owns-what
see `agent-roster.md`; for the gates and the autonomy-first protocol see
`coordination-protocol.md`.

---

## The mental model

Five moving parts:

- **Agents** (33) — a tiered team of specialists. They are the *workforce*: you (or a skill)
  delegate focused work to them; each runs in its own context so reads stay out of the main
  conversation. Directors decide, leads own a domain + a quality gate, specialists do the work,
  and an execution trio does the hands-on locate → build → review.
- **Skills** (54) — slash commands. They are *workflows*: a skill orchestrates the right agents
  through phases for a task ("design an API", "fix the build", "ship a release"). Invoke with
  `/rust-studio:<name>` (bare `/<name>` works when unambiguous).
- **Rules** (20) — path-scoped Rust standards. When you edit a matching file, a *pointer* to the
  relevant standard is auto-injected (a hook does this) and the agent reads the full rule on
  demand, so it has the right bar in front of it without bloating the window (`core.md` on every
  `.rs`, `api.md` on `lib.rs`, `unsafe.md` when `unsafe` appears, `ffi.md` on C-ABI boundaries,
  `macros.md` in proc/declarative macros, …).
- **Hooks** (7) — deterministic automation: stack briefing **+ memory recall** at session start,
  path-scoped rule pointers after edits, a lint nudge **and a memory-capture nudge** when you stop,
  and session-lifecycle aids (a `/recall` nudge on each prompt, a sub-agent verdict check, and
  compaction / session-end reminders).
- **Gates** — named checkpoints a lead clears before work proceeds: `ARCH / API / ASYNC / CLI /
  PERF / SAFETY / QA / RELEASE / BUILD`. Run at **lean** (one crate), **full** (public API,
  unsafe, releases), or **solo** (prototype) intensity.

The contract above all is the **protocol** (`coordination-protocol.md`): a *quality* loop, not a
permission loop. Agents **decide tactical calls and proceed**; they escalate to you only on a
strategic fork, an irreversible action, or an outward one (push / PR / publish). Standards:
no quick wins, finish the cross-crate ripple, modern idioms, observability-as-DoD, evidence over
opinion (`working-preferences.md`).

---

## How to use it — three ways in

1. **Run a skill.** `/dev-task add a retry policy to the http client` — the skill drives the
   whole flow. This is the usual entry point.
2. **Name an agent.** "Use `unsafe-auditor` to review this module" — delegate one focused job.
   Claude also picks agents automatically based on their descriptions.
3. **Just describe the task.** Claude routes to the right skill/agent. `/start` orients you and
   recommends the next move.

### The typical end-to-end flow
```
/start                 # detect stack, brief the team, route
/recall <area>         # pull prior learnings before you touch the area
/spec <feature>        # (big/cross-crate) explore → 2–4 approaches → approved spec doc
  /spec-tasks <slug>   #   break it into ordered tasks, each run via /dev-task
/dev-task <task>       # (one unit) scout → plan → approve → build → review
/tdd <behavior>        # (alt) build a behavior test-first: RED → GREEN → REFACTOR
/verify-loop           # drive checks to green with bounded auto-fix
/review --full         # parallel multi-lens audit before merge
/commit  →  /pr        # Conventional Commit, then open the PR
/session-wrap          # recap + capture learnings to memory for next time
```
Small change? Skip the spec — `/dev-task` or even a direct `/lint` + `/review` is enough.
Plan only when the approach is uncertain or the change spans files.

---

## The agents (33)

### Tier 1 — Directors (inherit — run at the session model)
- **`chief-architect`** — crate/module boundaries, layering, ADRs, big refactors, cross-lead
  technical conflicts. Holds ARCH-GATE. Call for any change that ripples across many crates.
- **`product-steward`** — scope, milestones, story breakdown, prioritization, cross-domain
  coordination. Call to turn a goal into ordered work or settle what's in/out of scope.

### Tier 2 — Leads (sonnet; own a domain + a gate)
- **`api-design-lead`** — public API surface, crate boundaries, semver, `#[non_exhaustive]`/
  sealing. API-GATE.
- **`async-systems-lead`** — async architecture, tokio topology, web stack choice, backpressure,
  shutdown. ASYNC-GATE.
- **`cli-ux-lead`** — CLI/TUI command structure, terminal UX, stdout/stderr discipline, exit
  codes. CLI-GATE.
- **`systems-perf-lead`** — performance budgets, `unsafe` policy, FFI, `no_std`, memory model.
  PERF-GATE + SAFETY-GATE.
- **`qa-lead`** — test strategy, coverage targets, flakiness, the quality bar. QA-GATE.
- **`release-lead`** — semver decisions, crates.io publishing, changelog, MSRV. RELEASE-GATE.
- **`tooling-lead`** — *decides* build/CI/dev-tooling policy + matrix strategy. BUILD-GATE.
  (Delegates implementation to `build-engineer`.)

### Tier 3 — Specialists (sonnet; auditors inherit/opus)
API & types: **`api-designer`** (traits, type-state, builders, conversions), **`error-architect`**
(thiserror/anyhow boundary, error taxonomy), **`macro-specialist`** (proc/derive/`macro_rules!`),
**`docs-engineer`** (rustdoc, doc-tests, README).
Async & web: **`async-runtime-specialist`** (tokio, cancellation, spawn), **`web-framework-specialist`**
(axum/actix, extractors, middleware), **`database-specialist`** (sqlx/diesel, migrations, pools),
**`observability-engineer`** (tracing, metrics, OTel), **`wasm-specialist`** (wasm32, wasm-bindgen, size).
Systems & perf: **`concurrency-specialist`** (atomics, lock-free, loom), **`unsafe-auditor`**
(inherit; reviews every `unsafe` for soundness, miri — read-only), **`ffi-specialist`** (bindgen/cbindgen,
C ABI), **`perf-engineer`** (criterion, flamegraph, allocations, SIMD), **`embedded-specialist`**
(`no_std`, embedded-hal, cortex-m).
CLI: **`cli-specialist`** (clap derive, ratatui, completions, signals).
Quality: **`test-engineer`** (proptest, criterion, nextest, fixtures), **`security-auditor`** (opus;
RUSTSEC, input/secret/auth/DoS), **`dependency-manager`** (sonnet; cargo-deny, features, MSRV),
**`build-engineer`** (*implements* build.rs, CI, cross, xtask).
Cross-cutting: **`harsh-critic`** (inherit; attacks designs/specs adversarially — no praise, read-only).

### Execution (4) — the hands
- **`rust-scout`** (haiku, read-only) — locates symbols/impls/tests via serena, returns a
  `file:line` map. Never writes or proposes fixes.
- **`rust-builder`** (sonnet) — the only agent that routinely writes source; implements an
  approved plan, runs cargo check/clippy/test/fmt, reports a diff.
- **`rust-build-resolver`** (sonnet) — gets a failing build green; fixes the root cargo/rustc
  error (borrowck, trait bounds, lifetimes) in a check→fix loop.
- **`rust-reviewer`** (inherit, read-only) — final gate before merge; severity-tagged findings,
  no praise, flags only correctness/requirement gaps.

---

## The skills (55)

### Onboarding & navigation
- **`/start`** — orient: detect stack, brief the team, route to the next skill.
- **`/help`** — the catalog (filter by topic, e.g. `/help async`).
- **`/env-setup`** — provision the machine: OS build prerequisites, latest stable Rust via
  rustup (+ components), `cargo-binstall`, and the studio's cargo tool suite as prebuilt
  binaries (`check` mode = report only).
- **`/detect-stack`** — classify a project's domain(s) + the relevant leads/specialists/rules.
- **`/adopt`** — reverse-engineer an existing crate/workspace into studio docs + a debt catalog.

### Design & architecture
- **`/brainstorm`** — explore an idea before any design (2–4 approaches, no code).
- **`/design-api`** — design one public API surface (lighter than `/team-api`).
- **`/architecture`** — design/revise module/crate layout; records ADRs.
- **`/adr`** — write and file one architecture decision record.
- **`/model-domain`** — encode a domain in the type system (newtype, type-state, make illegal
  states unrepresentable).

### Build
- **`/dev-task`** — implement one unit end-to-end: scout → plan → approve → build → review.
- **`/new-crate`** — scaffold a crate/workspace member with studio conventions.
- **`/add-dep`** — vet a crate (RUSTSEC, license, MSRV, features) before adding it.
- **`/refactor`** — behaviour-preserving cleanup driven by clippy + standards.
- **`/fix-build`** — get a failing `cargo build`/`check` green (drives `rust-build-resolver`).

### Spec-driven (big / cross-crate work, persisted in `.rust-studio/specs/`)
- **`/spec`** — explore → weigh approaches → an approved spec doc.
- **`/spec-tasks`** — break a spec into ordered tasks, drive each via `/dev-task`.
- **`/spec-verify`** — prove the implementation meets the spec's acceptance criteria; archive.

### TDD & verification
- **`/tdd`** — build a behaviour test-first: RED → GREEN → REFACTOR.
- **`/verify-loop`** — run fmt/clippy/nextest and auto-fix in a bounded loop (≤3) until green.

### Quality & review
- **`/review`** — audit a diff for correctness/scope/tests (`--full` = parallel multi-lens).
- **`/lint`** — rustfmt + clippy zero-warning gate (`--fix` applies).
- **`/audit-unsafe`** — review all `unsafe` (invariants, miri).
- **`/perf`** — profile → benchmark → optimize → prove the win with before/after numbers.
- **`/bloat`** — measure binary size (cargo-bloat/llvm-lines), cut it, prove the delta in bytes.
- **`/security-audit`** — CODE security: untrusted input, injection, secrets, auth + advisories.
- **`/deps-check`** — DEPENDENCY hygiene: cargo-deny, versions, duplicates, features, MSRV.
- **`/api-review`** — semver hazards + required version bump on a public-API change.
- **`/tech-debt`** — scan + prioritize debt (TODO/FIXME, `#[allow]`, `unwrap` in libs, …).
- **`/scope-check`** — compare a diff/plan against acceptance criteria; flag creep.

### Testing
- **`/test-plan`** — a test plan for a feature (types, cases, edge cases, property laws).
- **`/test-setup`** — wire proptest/criterion/nextest/coverage into the project.
- **`/coverage`** — measure coverage, surface meaningful gaps, close them.
- **`/mutants`** — mutation-test the suite (cargo-mutants): find code tests run but don't check.
- **`/fuzz`** — coverage-guided fuzzing (cargo-fuzz) on untrusted-input surfaces; every crash
  becomes a minimized regression test.
- **`/flaky-hunt`** — reproduce, diagnose, and fix/quarantine a flaky test.

### Memory (cross-session, in the Obsidian vault via the `obsidian` MCP)
- **`/remember`** — capture a durable learning (decision/gotcha/convention/fix).
- **`/recall`** — surface prior learnings for a topic before you work.
- **`/session-wrap`** — recap the session, capture learnings, suggest the next step.
- Capture is also **automatic**: the work skills (`/dev-task`, `/debug`, `/verify-loop`,
  `/refactor`, `/spec-verify`) run `/remember` for durable learnings, and the `auto_capture`
  Stop hook nudges you once after a completed unit if nothing was saved. Recall is automatic at
  session start (`memory_recall`). Both toggle via `/plugin` → Rust Code Studio.
- The full contract (recall-before, remember-after, `MEMORY:` verdict lines, vault path rule)
  lives in [`docs/memory-protocol.md`](memory-protocol.md).

### Ship & release
- **`/commit`** — Conventional Commit for the current changes (fmt/clippy first; no hook bypass).
- **`/pr`** — open a PR with a value-first description via `gh`.
- **`/changelog`** — generate/update CHANGELOG.md (Keep a Changelog).
- **`/msrv-check`** — verify the real MSRV vs the declared `rust-version`.
- **`/publish`** — RELEASE-GATE checklist → dry-run → hands you the exact publish command
  (never publishes itself).

### Teams (multi-agent presets for end-to-end features)
- **`/team-api`** — design + ship a public API with the API team.
- **`/team-async`** — build an async service feature with the async team.
- **`/team-perf`** — performance + safety hardening with the systems team.
- **`/team-release`** — the full release pipeline (audit + deps + MSRV + changelog + dry-run).

### Following progress (visibility)
- Per-sub-agent rows in the agent panel are customized automatically (the plugin's
  `subagentStatusLine`): `● <type>: <description> · <elapsed> · <tokens>`.
- **`/progress-bar`** — opt-in: wire the main status bar to show the live orchestration phase
  (`🦀 rust-studio · ▸ build 2/4 · <model> · ctx %`); `/progress-bar off` removes it.

### Studio self-check
- **`/eval-agents`** — run the review agents against planted-defect fixtures and score recall
  (quality-assures the plugin itself).

---

## Worked examples

**Add a feature to one crate**
```
/recall caching          # anything we already decided here?
/dev-task add an LRU eviction policy to Cache, configurable via CacheConfig
/review                  # audit the diff
/commit  →  /pr
```

**A large, cross-crate change**
```
/spec migrate the credential store to the new sealed-trait API
/spec-tasks credential-store-migration      # ordered tasks
# … each task runs through /dev-task (which builds + reviews) …
/spec-verify credential-store-migration     # prove it against the spec, archive
/review --full           # multi-lens, since it's breaking + cross-crate
```

**Fix a bug, test-first**
```
/tdd login fails after token refresh — write a failing test that reproduces it, then fix
/verify-loop             # drive everything green
/commit
```

**Make it fast**
```
/perf the request decoder is slow on large payloads
# profile → bench baseline → optimize → before/after numbers (reverts if no win)
```

**Onboard an unfamiliar codebase**
```
/adopt path/to/workspace # structure, domains, public API, debt catalog
/detect-stack            # which leads/specialists/rules apply
```

**Cut a release**
```
/team-release 0.4.0      # security audit + deps + MSRV + changelog + dry-run
/publish my-crate        # gate + dry-run, then run the printed command yourself
```

---

## Tooling, memory, and large workspaces
- Agents prefer **serena** (semantic code nav) and `rg`/`ast-grep` over Bash search, **exa** for
  external evidence, and purpose-built `cargo` subcommands — see `tooling.md`.
- Memory has two layers that share **one** Obsidian vault under a per-project folder:
  - the **shared project store** — `/remember`, `/recall`, and the session-start recall hook
    read/write `<vault>/projects/<project>/` through the `obsidian` MCP (the hook reads the files
    directly, since a command hook has no MCP access);
  - **per-agent memory** — `chief-architect`, `unsafe-auditor`, and `security-auditor` carry
    `memory: project`, so the harness injects each agent's own `MEMORY.md` at start. For these to be
    *one* store, the harness auto-memory path must be junctioned into the vault's project folder; if
    it is not, an agent's memory and `/recall` will diverge. The read-only auditors surface durable
    findings on a `MEMORY:` line so the orchestrator can `/remember` them into the shared store.
- For big multi-crate workspaces, see `large-workspace.md` (per-crate CLAUDE.md, `target/`
  read-denies, sparse worktrees, the bundled rust-analyzer LSP).
