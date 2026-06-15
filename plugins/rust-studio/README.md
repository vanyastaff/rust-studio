# Rust Code Studio

**Turn a single Claude Code session into a full Rust engineering studio.**
A tiered agent team, path-scoped Rust standards, quality gates, and cargo-aware hooks —
for libraries, async/web services, CLIs, and systems/embedded code.

> Inspired by the studio model of
> [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios),
> rebuilt from the ground up for Rust and packaged as a Claude Code plugin.

- **33 agents** — 2 directors → 7 leads → 20 specialists (incl. an adversarial `harsh-critic`) + a scout/builder/resolver/reviewer execution group
- **48 skills** — design, spec-driven build, TDD, review, test, release, git/PR shipping, build-fixing, cross-session memory, and a self-check harness
- **17 path-scoped rule sets** — a pointer to the right Rust standard surfaces the moment you open or edit a matching file; the agent reads the full rule on demand (keeps the window lean)
- **7 hooks** — stack detection **+ memory recall** at session start, path-scoped rule pointers, a lint nudge, and session-lifecycle aids (a `/recall`-before-work nudge, a sub-agent verdict check, and compaction / session-end reminders)

---

## The idea

Solo AI coding drifts: no boundaries, no review, no "are we sure?". This plugin imposes a
studio: specialists who own a domain, leads who hold quality gates, and one rule above all —

> **Question → Options → Decision → Draft → Approval** — run as a quality loop, autonomy-first:
> decide tactical calls and proceed; escalate only on strategic, irreversible, or outward steps.

See [`docs/coordination-protocol.md`](docs/coordination-protocol.md) for the full contract
and [`docs/agent-roster.md`](docs/agent-roster.md) for who owns what.

## The team

**Directors (opus)** — `chief-architect` (ARCH-GATE), `product-steward` (scope & sequencing).

**Leads (sonnet)** — `api-design-lead`, `async-systems-lead`, `cli-ux-lead`,
`systems-perf-lead`, `qa-lead`, `release-lead`, `tooling-lead`. Each owns a quality gate.

**Specialists (sonnet/haiku; auditors opus)** — API (`api-designer`, `error-architect`,
`macro-specialist`, `docs-engineer`), async/web (`async-runtime-specialist`,
`web-framework-specialist`, `database-specialist`, `observability-engineer`,
`wasm-specialist`), systems/perf (`concurrency-specialist`, `unsafe-auditor`,
`ffi-specialist`, `perf-engineer`, `embedded-specialist`), CLI (`cli-specialist`),
quality (`test-engineer`, `security-auditor`, `dependency-manager`, `build-engineer`), and a
cross-cutting adversarial `harsh-critic` (attacks designs/specs — challenges the premise, no praise).

**The hands** — `rust-scout` (locate, read-only) → `rust-builder` (implement) →
`rust-build-resolver` (get the build green) → `rust-reviewer` (audit & gate).

## Quality gates

`ARCH-GATE` · `API-GATE` · `ASYNC-GATE` · `CLI-GATE` · `PERF-GATE` · `SAFETY-GATE` ·
`QA-GATE` · `RELEASE-GATE` · `BUILD-GATE`. Run them at **full**, **lean**, or **solo**
intensity to match the work.

## Skills (slash commands)

> Plugin commands are namespaced: `/rust-studio:<name>`.

- **Onboarding** — `/start` · `/help` · `/detect-stack` · `/adopt`
- **Design** — `/brainstorm` · `/design-api` · `/architecture` · `/adr` · `/model-domain`
- **Build** — `/dev-task` · `/new-crate` · `/add-dep` · `/refactor` · `/fix-build`
- **Spec-driven** — `/spec` · `/spec-tasks` · `/spec-verify` (persisted in `.rust-studio/specs/`)
- **TDD & verify** — `/tdd` · `/verify-loop`
- **Quality** — `/review` (`--full` = parallel multi-lens) · `/lint` · `/audit-unsafe` · `/perf` · `/security-audit` · `/deps-check` · `/api-review` · `/tech-debt` · `/scope-check`
- **Testing** — `/test-plan` · `/test-setup` · `/coverage` · `/flaky-hunt`
- **Memory** — `/remember` · `/recall` · `/session-wrap` (cross-session, stored in the Obsidian vault via the `obsidian` MCP)
- **Ship** — `/commit` · `/pr`
- **Release** — `/publish` · `/changelog` · `/msrv-check`
- **Teams** — `/team-api` · `/team-async` · `/team-perf` · `/team-release`

## Path-scoped standards

When you edit a file, a pointer to the matching standard (name + one-line summary + path) is
injected automatically; the agent reads the full rule on demand ([`rules/`](rules)):

| Edit a… | …and you get |
|---------|--------------|
| `*.rs` | core idiomatic-Rust standards |
| `src/lib.rs` | public-API & semver standards |
| handler/route/server file | async/service standards |
| `benches/**` | performance standards |
| `main.rs` / `bin/**` | CLI standards |
| `tests/**` | testing standards |
| `Cargo.toml` | manifest, dependency & workspace-lints hygiene |
| `build.rs` | build-script hygiene |
| domain/model/`error*.rs` | type-system, variance & error-taxonomy standards |
| `ffi*.rs` / `*-sys` crate | FFI / C-interop layout, ABI & unwind safety |
| macro crate (`*-macros`, `proc-macro*`) | `macro_rules!`/proc-macro hygiene & choice |
| handler/route/parser/auth file | security standards (untrusted-input boundary) |
| anything with `unsafe` | unsafe-code standards — UB catalog, `repr`, `&raw`, `MaybeUninit` |

## Hooks

- **SessionStart** — detects the crate/workspace, edition, MSRV, and domain; briefs the team, and
  recalls the most relevant notes from the project's Obsidian-vault memory as a compact index —
  title + one-line hook + a direct path to read each note — ranked against the git branch /
  changed crates / last commit (`/recall` for deeper semantic search).
- **PreToolUse (Read/Write/Edit)** — injects a compact *pointer* to each path-scoped Rust
  standard (name + one-line summary + absolute path) *before* you read or edit a matching file,
  so the agent knows which standards bind and reads the full rule on demand — instead of dumping
  every rule body into the window on every file (the dominant context cost, see
  `tools/context-cost.ts`). An edit that introduces `unsafe` also points to the unsafe-code
  standard. `core` leads every list; safety/security-critical rules are flagged ⚠️ REQUIRED.
- **UserPromptSubmit** — a light nudge to `/recall` before working in a known area and to prefer a
  studio skill when one fits.
- **Stop** — nudges `/lint` if changed `.rs` files aren't rustfmt-clean.
- **SubagentStop** — reminds the orchestrator to confirm a sub-agent returned an explicit verdict
  (COMPLETE / NEEDS WORK / BLOCKED) with evidence before advancing past it.
- **PreCompact / SessionEnd** — remind you to persist an in-flight plan to a durable file and to
  run `/session-wrap` so learnings are captured to memory.

Hooks are TypeScript, run via [`bun`](https://bun.sh). If `bun` isn't on PATH they no-op — the
studio still works, you just lose auto-injection and recall. Each hook reads stdin behind a
hard timeout with a watchdog, so it can never freeze the session (even mid-subagent). See
[`../../INSTALL.md`](../../INSTALL.md).

## Quick start

```text
/start            # detect the stack and route you
/dev-task <task>  # implement one unit of work: scout → plan → approve → build → review
/review           # audit your current diff against the gates
/team-api <api>   # design & ship a public API with the API team
```

## Requirements & tooling

> **Installing the plugin itself** (local marketplace, no GitHub remote needed) →
> [`../../INSTALL.md`](../../INSTALL.md).

### Required

- **Claude Code** with plugin support.
- **Rust toolchain** via [rustup](https://rustup.rs) — `cargo` + `rustc`, plus the `rustfmt`
  and `clippy` components (default with rustup; otherwise `rustup component add rustfmt clippy`).
  Agents run `cargo check / clippy / test / fmt` on almost every task.

### Recommended baseline

The core quality loop reaches for these constantly — install once:

```sh
cargo install cargo-nextest cargo-deny cargo-audit
```

- **`cargo-nextest`** — fast, isolated test runner (`/review`, `/test-*`, `/verify-loop`).
- **`cargo-deny`** — license / advisory / source policy (`/deps-check`, RELEASE-GATE).
- **`cargo-audit`** — RUSTSEC advisory scan (`/security-audit`).
- **`bun`** on PATH — runs the hooks (auto rule-injection, memory recall, lint nudge). Absent →
  hooks no-op safely and the studio still works. Install: see [`../../INSTALL.md`](../../INSTALL.md).

### On-demand (the skill that needs a tool names it and suggests the install)

| When you run… | Tools | Install |
|---|---|---|
| `/audit-unsafe`, any `unsafe` | `miri` (nightly), `cargo-careful` | `rustup +nightly component add miri` · `cargo install cargo-careful` |
| `/perf`, benchmarks | `cargo-flamegraph`, `samply`, `hyperfine`; `perf`/`valgrind` (Linux) | `cargo install flamegraph samply hyperfine` |
| `/api-review`, `/publish` | `cargo-public-api`, `cargo-semver-checks` | `cargo install cargo-public-api cargo-semver-checks` |
| `/msrv-check` | `cargo-msrv` | `cargo install cargo-msrv` |
| `/coverage` | `cargo-llvm-cov` (or `cargo-tarpaulin`) | `cargo install cargo-llvm-cov` |
| `/deps-check` | `cargo-hack`, `cargo-machete`, `cargo-hakari` (20+ crates) | `cargo install cargo-hack cargo-machete cargo-hakari` |
| macro crates | `cargo-expand` | `cargo install cargo-expand` |
| snapshot tests | `cargo-insta` | `cargo install cargo-insta` |
| mutation testing | `cargo-mutants` | `cargo install cargo-mutants` |
| FFI bindings | `bindgen` / `cbindgen` (+ system `libclang`) | `cargo install bindgen-cli cbindgen` |
| faster code navigation | `ripgrep` (`rg`), `fd`, `ast-grep` (`sg`) | `cargo install ripgrep fd-find ast-grep` |

**Not installed — these are crate `[dev-dependencies]`, written into your `Cargo.toml`, not your
`$PATH`:** `criterion` (benches), `loom` (lock-free model checking), `trybuild` (macro /
compile-fail tests), `insta` (snapshots).

**Platform notes:** `miri` needs a **nightly** toolchain; `perf` and `valgrind`/cachegrind are
Linux-only (macOS/Windows fall back to `samply`). Nothing here is hard-required — a missing tool
just makes the relevant skill report it's unavailable and point you at the install.

### Optional integrations

- **`rust-analyzer-lsp@claude-plugins-official`** — for large multi-crate workspaces, so
  `rust-scout` resolves symbols via the language server instead of scanning files. See
  [`docs/large-workspace.md`](docs/large-workspace.md) for the full focus-scoping setup
  (per-crate CLAUDE.md, `target/` read-denies, sparse worktrees) — Anthropic's large-codebase
  guidance, mapped to Rust.
- **MCP servers**, used when present: a symbol-navigation server (serena) for `rust-scout` /
  `rust-builder`, a web-search server (exa) for advisory / freshness lookups, and the `obsidian`
  server for cross-session memory (`/remember`, `/recall`).

## License

MIT — see [LICENSE](LICENSE).
