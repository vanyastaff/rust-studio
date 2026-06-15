# Rust Code Studio

**Turn a single Claude Code session into a full Rust engineering studio.**
A tiered agent team, path-scoped Rust standards, quality gates, and cargo-aware hooks —
for libraries, async/web services, CLIs, and systems/embedded code.

> Inspired by the studio model of
> [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios),
> rebuilt from the ground up for Rust and packaged as a Claude Code plugin.

- **33 agents** — 2 directors → 7 leads → 20 specialists (incl. an adversarial `harsh-critic`) + a scout/builder/resolver/reviewer execution group
- **45 skills** — design, spec-driven build, TDD, review, test, release, git/PR shipping, build-fixing, cross-session memory, and a self-check harness
- **10 path-scoped rule sets** — the right Rust standard injected when you edit a matching file
- **7 hooks** — stack detection **+ memory recall** at session start, path-scoped rule injection, a lint nudge, and session-lifecycle aids (a `/recall`-before-work nudge, a sub-agent verdict check, and compaction / session-end reminders)

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

When you edit a file, the matching standard is injected as context automatically
([`rules/`](rules)):

| Edit a… | …and you get |
|---------|--------------|
| `*.rs` | core idiomatic-Rust standards |
| `src/lib.rs` | public-API & semver standards |
| handler/route/server file | async/service standards |
| `benches/**` | performance standards |
| `main.rs` / `bin/**` | CLI standards |
| `tests/**` | testing standards |
| `Cargo.toml` | manifest & dependency hygiene |
| `build.rs` | build-script hygiene |
| handler/route/parser/auth file | security standards (untrusted-input boundary) |
| anything with `unsafe` | unsafe-code standards (+ a SAFETY reminder) |

## Hooks

- **SessionStart** — detects the crate/workspace, edition, MSRV, and domain; briefs the team, and
  recalls the most relevant notes from the project's Obsidian-vault memory (ranked against the git
  branch / changed crates / last commit).
- **PostToolUse (Write/Edit)** — injects the path-scoped Rust standard for the file you edited.
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

## Requirements

- Claude Code (plugin support).
- `cargo` (the agents run `cargo check/clippy/test/fmt`, criterion, miri, etc.).
- `bun` on PATH for hooks (optional but recommended).
- For large multi-crate workspaces, pair with `rust-analyzer-lsp@claude-plugins-official` so
  `rust-scout` resolves symbols via the language server instead of scanning files. See
  [`docs/large-workspace.md`](docs/large-workspace.md) for the full focus-scoping setup
  (per-crate CLAUDE.md, `target/` read-denies, sparse worktrees) — Anthropic's official
  large-codebase guidance, mapped to Rust.

## License

MIT — see [LICENSE](LICENSE).
