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

## Skills — by purpose

This is the curated map (which family to reach for); the exhaustive, always-current
list of every installed skill is generated below it.

**Onboarding:** `/start` · `/help` · `/env-setup` (provision the machine: rustup + binstall + tool suite) · `/detect-stack` · `/adopt`
**Design & architecture:** `/brainstorm` · `/grill-me` (interview me to pull my input) · `/design-api` · `/architecture` · `/adr` · `/model-domain`
**Build:** `/dev-task` · `/new-crate` · `/add-dep` · `/refactor` · `/fix-build` · `/ci-gate` (anti-hang / anti-silencing CI gate)
**Spec-driven:** `/spec` · `/spec-tasks` · `/spec-verify`
**TDD & verify:** `/tdd` · `/verify-loop`
**Debug:** `/debug` (root-cause runtime bugs) · `/fix-build` (compile errors) · `/flaky-hunt` (flaky tests)
**Quality & review:** `/review` (`--full` = parallel multi-lens) · `/doc-review` (specs/plans/ADRs) · `/lint` · `/audit-unsafe` · `/perf` · `/bloat` (binary size) · `/security-audit` · `/deps-check` · `/api-review` · `/tech-debt` · `/scope-check`
**Studio self-check:** `/eval-agents` (run the review agents against planted-bug fixtures)
**Testing:** `/test-plan` · `/test-setup` · `/coverage` (what runs) · `/mutants` (what's checked) · `/fuzz` (inputs nobody imagined) · `/flaky-hunt`
**Memory (cross-session):** `/remember` · `/recall` · `/session-wrap`
**Release:** `/publish` · `/changelog` · `/msrv-check`
**Ship (git):** `/commit` · `/pr` · `/resolve-pr` (work through PR review feedback)
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
standards live in `references/`; cross-session memory in the Obsidian vault
via the `obsidian` MCP, under the memory contract in
`references/memory-protocol.md` (recall-before / remember-after / `MEMORY:` lines).
