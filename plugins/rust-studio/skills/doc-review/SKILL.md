---
name: doc-review
description: "doc review, review spec, review plan, review ADR, review design — audit a requirements/spec/plan/ADR/design document (not code) with a parallel persona panel: coherence, feasibility, scope, security-at-plan-level, and an adversarial critic. Use before committing to a non-trivial design or after a spec/plan is drafted."
argument-hint: "[path to the doc, or the spec/ADR id]"
user-invocable: true
---

# /doc-review — audit a design document

Stress-test a document's *decisions*, not its prose. Surface contradictions, unstated
assumptions, infeasible steps, scope creep, and threat-model gaps before they become code.
Proposals, not commands (`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md` — findings are
input to the author's judgment; never echo-chamber-validate the existing structure).
Protocol: `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §8 (team execution).

## Orchestration
When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), run the panel as a
real team: `TeamCreate`, then create one `TaskCreate` task per persona (the personas are
independent and read-only — no `addBlockedBy` between them) and spawn each as a teammate so
they run concurrently, reporting via `SendMessage`; the lead merges and de-duplicates. The
lighter alternative for these read-only personas is to spawn each as a **background subagent**
(`background: true`) without forming a team. Otherwise fall back to single-orchestrator
delegation: spawn the personas sequentially and inline the document text into each spawn
prompt. Teammates don't inherit this context (pass the doc in the spawn prompt) and don't get
bundled MCP (they rely on the user's ambient serena/exa). Drive `TeamDelete` cleanup at the
end (shut teammates down with `SendMessage {type:"shutdown_request"}` first).

## When NOT this skill
- Reviewing a code diff → `/review`.
- Checking a diff/plan against acceptance criteria only → `/scope-check`.
Use `/doc-review` for specs, plans, ADRs, RFCs, and design docs.

## How to run
1. Read the doc named in `$ARGUMENTS` (default: the most recently changed file under
   `.rust-studio/specs/`, `docs/adr/`, or `docs/`). State what you're reviewing.
2. Fan out the relevant lenses **in parallel** (one task per persona, or background subagents
   — see Orchestration; skip the ones the doc doesn't touch), each returning severity-tagged
   findings — not a grade:
   - **`harsh-critic`** — attack the premise: is the problem real, is this the right
     decomposition, what radically different approach was dismissed without reason?
   - **`chief-architect`** — internal coherence + boundary/dependency-direction fit with the
     existing workspace; contradictions between sections; terminology drift.
   - **`product-steward`** — scope vs stated goal: unjustified abstraction, premature
     framework, over/under-scope, sequencing risk.
   - **`security-auditor`** — plan-level threat model: auth/authz assumptions, data-exposure
     and confused-deputy/SSRF/exfiltration gaps the design glosses over.
   - **`qa-lead`** — testability: can each acceptance criterion be proven? what's unfalsifiable?
   - A domain lead when the doc is domain-specific (`async-systems-lead`, `api-design-lead`
     for a public-surface/semver decision, `systems-perf-lead` for unsafe/perf claims).
3. Merge and de-duplicate. Resolve disagreements between lenses explicitly — don't average them.

## Output
Ordered by severity, one line each, grouped by dimension:

```
§<section>  🔴 CONTRADICTION / BLOCKER: <what breaks>. <what to decide>.
§<section>  🟠 UNSTATED ASSUMPTION / FEASIBILITY: <the gap>. <how to close>.
§<section>  🟡 SCOPE / COMPLEXITY: <over-reach>. <leaner option>.
§<section>  🔵 AMBIGUITY: <where two readers diverge>. <the clarifying edit>.
```

Skip empty dimensions — no padding, no praise. End with **READY (proceed) / REVISE (numbered
must-fixes) / RECONSIDER (the premise itself is shaky)**. Offer to fold accepted findings into
the doc, or hand a revise list to `/spec` / `/adr`.
