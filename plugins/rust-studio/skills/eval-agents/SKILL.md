---
name: eval-agents
description: "eval-agents evaluate benchmark fixtures — run rust-reviewer / unsafe-auditor / security-auditor against planted-defect fixtures and score recall. Use to quality-assure the studio's review agents before publishing or after editing an agent prompt."
argument-hint: "[optional: fixture name or agent name; default: all]"
user-invocable: true
---

# /eval-agents — does the studio actually catch bugs?

Run the studio's review agents against the planted-defect fixtures in
`${CLAUDE_PLUGIN_ROOT}/benchmarks/` and score recall against ground truth. This tests the
*studio itself* — quality assurance for the plugin, not the user's code.
Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §8 (team execution).

## Orchestration
When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), run the fixtures as a
real team: `TeamCreate`, then create one `TaskCreate` task per fixture (the fixtures are
independent and read-only — no `addBlockedBy` between them) and spawn each mapped agent as a
teammate so they run concurrently, reporting findings via `SendMessage`; the lead scores. The
lighter alternative for these read-only evaluations is to spawn each as a **background
subagent** (`background: true`) without forming a team. Otherwise fall back to
single-orchestrator delegation: spawn the agents sequentially, one per fixture. Teammates
don't inherit this context (pass the fixture's `input.rs` in the spawn prompt — never the
ground truth) and don't get bundled MCP (they rely on the user's ambient serena/exa). Drive
`TeamDelete` cleanup at the end (shut teammates down with `SendMessage
{type:"shutdown_request"}` first).

## Fixture layout
Each fixture lives at `benchmarks/fixtures/<agent>/<case>/` with:
- `input.rs` — Rust source with one or more **planted defects**.
- `ground-truth.md` — the defects that must be caught (id, line, type, severity).

Agent folder → agent mapping:

| Folder | Agent | Mode |
|--------|-------|------|
| `reviewer` | `rust-reviewer` | defect-recall |
| `integrity` | `rust-reviewer` | defect-recall |
| `unsafe` | `unsafe-auditor` | defect-recall |
| `security` | `security-auditor` | defect-recall |
| `perf` | `perf-engineer` | defect-recall / first-pass bar |
| `api` | `api-design-lead` | defect-recall / first-pass bar |
| `architecture`, `workspace`, `active-dev`, `prior-art` | `chief-architect` | first-pass bar |
| `lifetimes`, `modern-rust`, `naming` | `rust-reviewer` | first-pass bar |

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
1. Resolve fixtures: use **Glob** (`benchmarks/fixtures/**/{input.rs,ground-truth.md}`) to
   enumerate cases. Filter by `$ARGUMENTS` if a case name or agent folder was given; otherwise
   run all. List what you'll evaluate before proceeding.
2. For each fixture, spawn the mapped agent (one task per fixture, or a background subagent —
   see Orchestration) on **only** `input.rs` — do not give it the ground truth. Ask it for
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
