---
name: help
description: "Use when choosing a Rust Code Studio workflow or specialist; list the available skills and agents by purpose."
---

# /help — studio catalog

Print a grouped catalog. If `input` names a topic (e.g. "async", "release",
"unsafe", "memory"), show only the relevant subset and the agents/skills for it.

Treat the host's available-skills list as the live source of truth. Use the curated map below for
grouping, omit unavailable entries, and mention that named studio agents run inline when the host
does not provide them.

## When NOT this skill
- You want the studio to look at *this* project and tell you what to do next →
  `/start`: it detects the actual stack and routes to one specific skill. `/help` prints
  the catalog; it does not inspect the project or choose for you.
- "Is the studio actually running here?" (hooks, runtime, agents, memory) → `/studio-doctor`,
  not a catalog question.

## Skills — by purpose

This is the curated map (which family to reach for); the exhaustive, always-current
list of every installed skill is generated below it.

**Onboarding:** `/start` · `/help` · `/env-setup` (provision the machine: rustup + binstall + tool suite) · `/detect-stack` · `/adopt` · `/studio-doctor` (is the studio actually live here?) · `/progress-bar` (the live status line)
**Design & architecture:** `/brainstorm` · `/grill-me` (interview me to pull my input) · `/prototype` (throwaway code that settles a design question) · `/design-api` · `/architecture` · `/adr` · `/model-domain`
**Find out:** `/research` (settle a question against crate source and docs.rs, cited) · `/recall` (what the studio already learned)
**Build:** `/dev-task` · `/new-crate` · `/add-dep` · `/refactor` · `/migrate` (edition or major-dependency upgrade) · `/fix-build` · `/ci-gate` (anti-hang / anti-silencing CI gate)
**Spec-driven:** `/spec` · `/spec-tasks` · `/spec-verify`
**TDD & verify:** `/tdd` · `/verify-loop`
**Debug:** `/debug` (root-cause runtime bugs) · `/fix-build` (compile errors) · `/flaky-hunt` (flaky tests)
**Quality & review:** `/review` (`--full` = parallel multi-lens) · `/doc-review` (specs/plans/ADRs) · `/lint` · `/audit-unsafe` · `/perf` · `/bloat` (binary size) · `/security-audit` · `/deps-check` · `/api-review` · `/tech-debt` · `/scope-check`
**Studio self-check:** `/eval-agents` (run the review agents against planted-bug fixtures) · `/studio-doctor` (hooks, runtime, agents, LSP, memory, cargo tooling)
**Testing:** `/test-plan` · `/test-setup` · `/coverage` (what runs) · `/mutants` (what's checked) · `/fuzz` (inputs nobody imagined) · `/flaky-hunt`
**Memory (cross-session):** `/remember` · `/recall` (verified) · `/memory-doctor` (audit, promote, import) · `/session-wrap`
**Release:** `/publish` · `/changelog` · `/msrv-check`
**Ship (git):** `/commit` · `/pr` · `/resolve-pr` (work through PR review feedback) · `/merge-conflicts` (resolve a stopped merge or rebase) · `/worktree-sweep` (prune leftover worktrees)
**Teams (multi-agent presets):** `/team-api` · `/team-async` · `/team-perf` · `/team-release`

## Agents

**Directors:** `chief-architect` (ARCH-GATE) · `product-steward`
**Leads:** `api-design-lead` · `async-systems-lead` · `cli-ux-lead` · `systems-perf-lead` · `qa-lead` · `release-lead` · `tooling-lead`
**Specialists:** `api-designer` · `error-architect` · `macro-specialist` · `docs-engineer` · `async-runtime-specialist` · `web-framework-specialist` · `database-specialist` · `observability-engineer` · `wasm-specialist` · `concurrency-specialist` · `unsafe-auditor` · `ffi-specialist` · `perf-engineer` · `embedded-specialist` · `cli-specialist` · `test-engineer` · `security-auditor` · `dependency-manager` · `build-engineer` · `harsh-critic`
**Execution:** `rust-scout` (locate) · `rust-builder` (implement) · `rust-build-resolver` (fix the build) · `rust-reviewer` (audit)

## How it fits together
See `references/agent-roster.md` for who-owns-what,
`references/sub-agents.md` for the inline fallback on hosts without named studio agents,
`references/coordination-protocol.md` for the gates and the autonomy-first
protocol, and `references/working-preferences.md` for the operating mode
(decide-don't-interrogate, no quick wins, modern idioms, observability-as-DoD). Path-scoped
standards live in `references/`; cross-session memory in the host's auto-memory
store (no MCP, no vault), under the memory contract in
`references/memory-protocol.md` (recall-before / remember-after / verify-before-it-steers /
`MEMORY:` lines).
