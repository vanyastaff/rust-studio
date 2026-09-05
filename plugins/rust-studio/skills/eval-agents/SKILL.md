---
name: eval-agents
description: "Use when running Claude Code benchmarks for the studio's Rust reviewer and auditors against planted defects."
disable-model-invocation: true
---

# /eval-agents — does the studio actually catch bugs?

> **Claude Code plugin only.** This evaluates the plugin's named Claude subagents and fixtures;
> it is not a generic Codex plugin evaluator. Resolve `<plugin-root>` as the directory two levels
> above this `SKILL.md` (or use `CLAUDE_PLUGIN_ROOT` when Claude provides it).

Run the studio's review agents against the planted-defect fixtures in
`<plugin-root>/benchmarks/` and score recall against ground truth. This tests the
*studio itself* — quality assurance for the plugin, not the user's code.
Protocol: `references/delegation.md` §8 (team execution).

## Orchestration
Spawn each fixture's mapped agent as its own sub-agent. The fixtures are independent and
read-only, so run them concurrently — Claude Code ≥ 2.1.232 runs spawned sub-agents in the
background by default and notifies you as each finishes; there is nothing to opt into. When
agent teams are enabled, the same fan-out can run as teammates over the shared task list
(one `TaskCreate` task per fixture, findings collected via `SendMessage`, the lead scores;
shut teammates down at the end with `SendMessage {type:"shutdown_request"}`). Sub-agents do
not inherit this context — pass the fixture's source in the spawn prompt, never the ground
truth — and do not get bundled MCP (they rely on the user's ambient serena/exa).

The same fixtures also ship as a **`claude plugin eval` suite** under `<plugin-root>/evals/`
(one prompt + graders per case, scored against a no-plugin baseline arm). When your account
has plugin eval enabled, `claude plugin eval <plugin-root> --no-publish` scores them outside
any session; this skill is the in-session path and needs no enablement.

## Fixture layout
Each fixture lives at `benchmarks/fixtures/<agent>/<case>/` and always carries:
- `ground-truth.md` — the defects that must be caught (id, line, type, severity).

The source comes in one of two shapes:
- **Single-file** — `input.rs`, Rust source with one or more **planted defects**. The default.
- **Multi-file** — a `src/` tree instead of `input.rs`, for defects that only appear at scale
  (a grep sweep that reads clean across many files, a broken primitive under correct call
  sites). Point the agent at the directory. Its `ground-truth.md` carries the audit prompt the
  fixture is calibrated for — use that prompt rather than the diff-review framing, because a
  fixture measuring whether an agent samples instead of reading is void if you hand it one file
  and tell it to read that file.

Agent folder → agent mapping:

| Folder | Agent | Mode |
|--------|-------|------|
| `reviewer` | `rust-reviewer` | defect-recall (first-pass bar where the ground truth declares a verdict) |
| `integrity` | `rust-reviewer` | defect-recall |
| `unsafe` | `unsafe-auditor` | defect-recall |
| `security` | `security-auditor` | defect-recall |
| `perf` | `perf-engineer` | defect-recall / first-pass bar |
| `api` | `api-design-lead` | defect-recall / first-pass bar |
| `architecture`, `workspace`, `active-dev`, `prior-art` | `chief-architect` | first-pass bar |
| `lifetimes`, `modern-rust`, `naming` | `rust-reviewer` | first-pass bar |
| `async` | `async-runtime-specialist` | defect-recall |
| `error-model` | `error-architect` | defect-recall |
| `testing` | `qa-lead` | defect-recall |
| `cli` | `cli-ux-lead` | defect-recall |
| `ffi` | `ffi-specialist` | defect-recall |
| `macros` | `macro-specialist` | defect-recall |
| `observability` | `observability-engineer` | defect-recall |
| `cargo-manifest` | `dependency-manager` | defect-recall |
| `database` | `database-specialist` | defect-recall |
| `build-scripts` | `build-engineer` | defect-recall |
| `embedded` | `embedded-specialist` | defect-recall |
| `wasm` | `wasm-specialist` | defect-recall |
| `scout` | `rust-scout` | map-recall (the ground truth is the expected `file:line` map; the agent passes when every row is present, no verdict token needed) |
| `docs` | `docs-engineer` | defect-recall |
| `release` | `release-lead` | defect-recall |

`tools/eval-runner.ts` carries the same table (`FIXTURE_AGENTS`) and runs this protocol headless
(`bun tools/eval-runner.ts --fixtures`) for accounts without `claude plugin eval`; keep the two in
step — `bun test` fails when a fixture folder has no mapping.

## Two fixture modes
- **defect-recall** — the classic "find the planted bug in finished code" fixture. Score
  `recall = caught / planted`.
- **first-pass bar** — the pre-code / reshape fixtures (their `ground-truth.md` declares a
  verdict of **RESHAPE NEEDED** or **REDO-TO-BAR**). These measure whether the maintainer bar
  is actually enforced, not whether the code compiles: the agent **passes only if it returns
  that verdict** (wrong-crate, shim-in-active-dev, incomplete cross-crate ripple, bool/stringly
  API, clone-to-appease-borrowck, hot-loop allocation, stale idiom, reinvented prior art) — a
  "looks fine, it compiles" response is a FAIL even if it lists no bugs. Score both the verdict
  and the per-row recall.

## Steps
1. Resolve fixtures: use **Glob** (`benchmarks/fixtures/**/ground-truth.md`) to enumerate cases —
   every fixture has one, where `input.rs` exists only for single-file cases. Filter by `input`
   if a case name or agent folder was given; otherwise run all. List what you'll evaluate before
   proceeding.
2. For each fixture, spawn the mapped agent (one sub-agent per fixture — see Orchestration)
   on **only** the source — `input.rs`, or the `src/` tree for a multi-file
   fixture, using the audit prompt its ground truth names. Never pass the ground truth itself. Ask it for
   ITS native output, not a custom format (so its own verification ritual fires). For
   **first-pass bar** fixtures, ask for the reject verdict in the agent's own vocabulary:
   **RESHAPE NEEDED** for a pre-code lead/specialist (`chief-architect`, `api-design-lead`,
   `perf-engineer`), **REDO-TO-BAR** for `rust-reviewer` — both mean "rejected the shape";
   `ACCEPTABLE` is a fail. Treat `input.rs` as code the agent must not wave through. Collect
   findings via `SendMessage` when run as a team.
3. Compare findings to `ground-truth.md`. For each planted defect mark **caught / missed**;
   note **false positives** (findings with no ground-truth entry — judge if they're real or
   noise). Match on defect type + line vicinity, not exact wording. For first-pass-bar
   fixtures, ALSO record whether the agent returned a reject verdict (RESHAPE NEEDED /
   REDO-TO-BAR) — a missing verdict (or `ACCEPTABLE`) is a fail even if some rows were noted.
   For `perf-engineer` / `unsafe-auditor`, also confirm the verification step was named
   (the criterion bench / `miri` run-or-skip-reason) — its absence is a prompt gap to flag.
4. Score per fixture: `recall = caught / planted`. Aggregate per agent.
5. Report a table and verdict. When recall < 100%, propose the one-line prompt change to the
   agent that would have caught the missed defect — do not apply it here, surface it for the user.

## Output
```
fixture                          agent             mode            verdict       recall   missed
reviewer/unwrap-and-cast         rust-reviewer     defect-recall   —             2/3      GT-3 (truncating cast)
unsafe/missing-safety            unsafe-auditor    defect-recall   —             3/3      —
architecture/wrong-crate-helper  chief-architect   first-pass bar  RESHAPE ✓     2/2      —
lifetimes/clone-to-appease-…     rust-reviewer     first-pass bar  REDO-TO-BAR ✓ 3/3      —
api/bool-and-stringly-types      api-design-lead   first-pass bar  (none) ✗      1/3      verdict missed → waved it through
```
End with a verdict per agent: **SOLID** (full recall + the expected reshape/redo verdict on
first-pass-bar fixtures, no noise) or **NEEDS PROMPT FIX** (missed defects OR a missing
maintainer verdict listed with the suggested one-line prompt fix each). A first-pass-bar
fixture where the agent returned no reshape/redo verdict is the headline failure — it means
the studio would wave that shape through.

Adding a new fixture? Drop a `benchmarks/fixtures/<agent>/<case>/{input.rs,ground-truth.md}`
pair — the harness picks it up automatically.
