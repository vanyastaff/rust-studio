# Changelog

All notable changes to **Rust Code Studio** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-06-15

### Added

- **Automatic memory capture.** A new `auto_capture` Stop hook (on by default) nudges the
  agent once, after a turn that finished a real unit of work (a completion summary +
  uncommitted changes) without saving anything, to `/remember` any non-obvious, durable
  learning. It blocks the stop a single time and never re-blocks (`stop_hook_active` breaks
  the loop), so it is far gentler than `stop_guard`. Fails open — a stall allows the stop.
- **In-skill capture (Tier 1).** `/dev-task` (Phase 6), `/verify-loop`, `/debug`, and
  `/refactor` now run `/remember` for durable learnings as part of their close; `/spec-verify`'s
  capture hint became an explicit action. Capture now fires from the work loop, not only at
  session end.
- **Domain-aware session-start routing.** The SessionStart briefing maps the detected domain to
  the fitting entry skill (async/web → `/team-async`/`/design-api`, systems/embedded →
  `/team-perf`/`/audit-unsafe`, cli → `/dev-task`, library → `/design-api`/`/team-api`) instead
  of emitting a static list. Universal fallbacks (`/dev-task`, `/review`, `/help`) are still
  surfaced.
- **Write-to-memory criteria for the `memory: project` agents** (`chief-architect`,
  `unsafe-auditor`, `security-auditor`): they now record durable findings to project memory and
  surface a `MEMORY:` line so the orchestrator can `/remember` them into the shared vault.

### Changed

- `/dev-task`'s closing next-step suggestion now includes `/session-wrap`; `/lint` and
  `/ci-gate` now end with a concrete next command.
- `docs/usage-guide.md` and `README.md` document the two memory layers (the shared Obsidian
  vault used by `/remember` / `/recall` / session-start recall, vs. the per-agent
  `memory: project` store) and the new `auto_capture` toggle.

### Notes

- A raw-inbox capture tier on PreCompact/SessionEnd (writing an uncurated drop when the agent
  is unreachable and context is about to evaporate) was scoped and deferred.
