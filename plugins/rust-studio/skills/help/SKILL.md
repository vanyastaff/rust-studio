---
name: help
description: "List the studio's agents and skills grouped by purpose — the catalog. Use when you want the full list or aren't sure which skill or agent fits a task."
user-invocable: true
---

# /help — studio catalog

Print a grouped catalog. If `$ARGUMENTS` names a topic (e.g. "async", "release",
"unsafe", "memory"), show only the relevant subset and the agents/skills for it.

## Skills

**Onboarding:** `/start` · `/help` · `/detect-stack` · `/adopt`
**Design & architecture:** `/brainstorm` · `/design-api` · `/architecture` · `/adr` · `/model-domain`
**Build:** `/dev-task` · `/new-crate` · `/add-dep` · `/refactor` · `/fix-build`
**Spec-driven:** `/spec` · `/spec-tasks` · `/spec-verify`
**TDD & verify:** `/tdd` · `/verify-loop`
**Debug:** `/debug` (root-cause runtime bugs) · `/fix-build` (compile errors) · `/flaky-hunt` (flaky tests)
**Quality & review:** `/review` (`--full` = parallel multi-lens) · `/doc-review` (specs/plans/ADRs) · `/lint` · `/audit-unsafe` · `/perf` · `/security-audit` · `/deps-check` · `/api-review` · `/tech-debt` · `/scope-check`
**Studio self-check:** `/eval-agents` (run the review agents against planted-bug fixtures)
**Testing:** `/test-plan` · `/test-setup` · `/coverage` · `/flaky-hunt`
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
See `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md` for who-owns-what,
`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` for the gates and the autonomy-first
protocol, and `${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md` for the operating mode
(decide-don't-interrogate, no quick wins, modern idioms, observability-as-DoD). Path-scoped
standards live in `${CLAUDE_PLUGIN_ROOT}/rules/`; cross-session memory in the Obsidian vault
via the `obsidian` MCP.
