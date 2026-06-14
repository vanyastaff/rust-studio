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

| Folder | Agent |
|--------|-------|
| `reviewer` | `rust-reviewer` |
| `unsafe` | `unsafe-auditor` |
| `security` | `security-auditor` |
| `perf` | `perf-engineer` |
| `api` | `api-design-lead` |

## Steps
1. Resolve fixtures: use **Glob** (`benchmarks/fixtures/**/{input.rs,ground-truth.md}`) to
   enumerate cases. Filter by `$ARGUMENTS` if a case name or agent folder was given; otherwise
   run all. List what you'll evaluate before proceeding.
2. For each fixture, spawn the mapped agent (one task per fixture, or a background subagent —
   see Orchestration) on **only** `input.rs` — do not give it the ground truth. Collect its
   findings via `SendMessage` when run as a team.
3. Compare findings to `ground-truth.md`. For each planted defect mark **caught / missed**;
   note **false positives** (findings with no ground-truth entry — judge if they're real or
   noise). Match on defect type + line vicinity, not exact wording.
4. Score per fixture: `recall = caught / planted`. Aggregate per agent.
5. Report a table and verdict. When recall < 100%, propose the one-line prompt change to the
   agent that would have caught the missed defect — do not apply it here, surface it for the user.

## Output
```
fixture                         agent             recall   missed
reviewer/unwrap-and-cast        rust-reviewer     2/3      GT-3 (truncating cast)
unsafe/missing-safety           unsafe-auditor    3/3      —
security/injection              security-auditor  2/2      —
```
End with a verdict per agent: **SOLID** (full recall, no noise) or **NEEDS PROMPT FIX** (missed
defects listed with suggested one-line fix each).

Adding a new fixture? Drop a `benchmarks/fixtures/<agent>/<case>/{input.rs,ground-truth.md}`
pair — the harness picks it up automatically.
