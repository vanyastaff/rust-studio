# Diagnose Studio delivery

Run read-only probes and record actual results. Hooks fail open, so presence on disk cannot
prove delivery. Use `references/integrity-and-evidence.md` for evidence and the applicable
`references/codex-compat.md` or `references/claude-5-compat.md` for host behavior.

## Usage branch

For a usage request, skip installation probes. Run `bun scripts/usage-report.ts --days 7`
from the skill folder; use the requested window, with 0 meaning the full log. Follow
`references/usage-telemetry.md` for storage, coverage and its decision rule. Relay skill/role
counts split by model/user, sessions and projects, plugin-dev/eval versus genuine counts,
genuinely reached names, development-only names, never-seen names and non-Studio destinations.
Keep historical events intact and identify any aggregation through the catalog migration map.
Completion requires the full relevant report, including never-lists, and disclosed host gaps.

## Installation probes

Record host version/surface, installed plugin version and loaded plugin version. For every
row below report evidence or an explicit unknown, and the smallest concrete repair.

- Runtime: execute `bun --version`; absence disables the TypeScript ambient layer.
- Hooks: read handler configuration and count by event; separately test a handler with a
  synthetic payload and observe a real session event. Feed payloads as data through stdin
  or a data heredoc, never executable command interpolation. For the irreversible-action
  guard expect exit 2 plus block text for a destructive command and exit 0 for
  `--force-with-lease`. A synthetic pass leaves actual delivery unverified. Record whether
  the session received a stack briefing and source-rule pointer and where host errors appear.
- Version skew: compare the loaded version with the working tree manifest and installed
  cache versions. A disk edit does not activate the current session.
- Workers: inspect availability of researcher, designer, implementer, reviewer and verifier.
  Report named-worker versus inline mode under `references/sub-agents.md`; inline execution
  cannot establish required independence.
- Navigation: execute `rust-analyzer --version`. Inspect configured optional symbol/search
  services through the host's supported inventory. Their absence is normal; name a precision
  loss only when relevant and use `references/tooling.md` for prerequisites and fallbacks.
- Memory: resolve the store through `references/procedures/context-recall.md`, report path,
  note count, index/file agreement and host load budget. Propose review-work memory for gaps.
- Usage delivery: inspect existence and latest row date of usage.jsonl. Missing on a fresh
  install is neutral; absent after a week of sessions indicates missing delivery to investigate.
- Configuration: report effective gate intensity, runner, MSRV fallback and ambient toggles
  with their sources. Inspect delegation depth/concurrency caps, model/effort overrides and
  generated routing fields. Unset values are neutral. Validate support against the installed
  host and compare effective workers with `references/model-routing.md` before claiming
  inheritance. Report configuration values without exposing secrets.

Check Cargo tooling compatibility, not only installation. Run a scoped real operation for
tools consuming compiler/rustdoc output; record failure if the installed tool cannot handle
the current compiler. Use existing project scope and report costly or unavailable probes as
unverified rather than starting unrelated work.

| Capability | Probe/tools | Fallback or impact |
|---|---|---|
| Compiler and package manager | cargo, rustc | unavailable without them |
| Formatting and lints | rustfmt, clippy | gate evidence unavailable |
| Isolated test runner | cargo-nextest | cargo test |
| Dependency policy/security | cargo-deny, cargo-audit | partially overlapping checks only |
| Mechanical compatibility | cargo-semver-checks | cargo public-api, then manual review |
| Coverage | cargo-llvm-cov | cargo-tarpaulin |
| Unused dependencies | cargo-shear | cargo-machete or cargo-udeps |
| Duplicate/orphan/cycle evidence | similarity-rs, cargo-modules | manual structural review |
| Mutation and fuzz execution | cargo-mutants, cargo-fuzz | corresponding measurements unavailable |
| Interpreter safety checks | nightly miri | strongest SAFETY-GATE evidence unavailable |

## Report and repair boundary

Return worst rows first: working, fallback in use, failed with no fallback, unknown, or neutral.
Each row names the observed evidence and consequence. End **HEALTHY**, **DEGRADED**, or
**INERT**, with the highest-impact repair. Unknown delivery cannot support HEALTHY.

Prepare concrete commands or a diff for repairs. Apply only repairs already authorized by
the task through the appropriate configuration or implementation workflow. A host trust
decision remains a user action. Distinguish missing runtime, disabled/untrusted hooks,
unsupported orchestration and an older loaded plugin. Follow current host activation rules:
report required reload/restart steps without claiming that a disk update activated delivery.
When hooks cannot be delivered, propose static guidance from
`references/templates/agents-md.md`. Diagnosis alone stops with the report and repair proposal.
