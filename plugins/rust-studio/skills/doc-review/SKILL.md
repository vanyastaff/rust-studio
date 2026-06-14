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

## When NOT this skill
- Reviewing a code diff → `/review`.
- Checking a diff/plan against acceptance criteria only → `/scope-check`.
Use `/doc-review` for specs, plans, ADRs, RFCs, and design docs.

## How to run
1. Read the doc named in `$ARGUMENTS` (default: the most recently changed file under
   `.rust-studio/specs/`, `docs/adr/`, or `docs/`). State what you're reviewing.
2. Fan out the relevant lenses **in parallel** (skip the ones the doc doesn't touch), each
   returning severity-tagged findings — not a grade:
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
