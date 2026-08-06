---
name: doc-review
description: "Use when reviewing a requirements, spec, plan, ADR, or design document for coherence, feasibility, scope, and security."
---

# /doc-review — audit a design document

Stress-test a document's *decisions*, not its prose. Surface contradictions, unstated
assumptions, infeasible steps, scope creep, and threat-model gaps before they become code.
Proposals, not commands (`references/working-preferences.md` — findings are
input to the author's judgment; never echo-chamber-validate the existing structure).
Protocol: `references/delegation.md` §8 (team execution).

## Orchestration
Run independent read-only personas concurrently when the host exposes workers; otherwise run
them sequentially. Mirror personas in the host's task surface when available. Give each worker
the complete document and scope because workers may not inherit conversation context or tool
configuration. The lead merges and de-duplicates results. Follow
`references/delegation.md` §8 for host capability detection and cleanup.

## When NOT this skill
- Reviewing a code diff → `/review`.
- Checking a diff/plan against acceptance criteria only → `/scope-check`.
Use `/doc-review` for specs, plans, ADRs, RFCs, and design docs.

## How to run
1. Read the doc named in `input` (default: the most recently changed file under
   `.rust-studio/specs/`, `docs/adr/`, or `docs/`). State what you're reviewing.
2. **Mechanical prose pass** (cheap, before the fan-out) — findings, not style polish:
   - near-duplicate paragraphs/blocks: the same point or limitation stated twice in one
     doc (an edit pass appended a revision without removing the original);
   - change-history narration ("this used to be", "moved here from", "previously"):
     belongs in git, not in the doc's current state;
   - private process IDs leaking into the text (Cycle N, audit/review IDs, `PR #NNN
     review`, spec success-criteria numbers): a reader without the process history cannot
     resolve them — state the invariant instead.
3. Fan out the relevant lenses **in parallel** (one task per persona, or background subagents
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
4. Merge and de-duplicate (the mechanical prose pass's findings included). Resolve
   disagreements between lenses explicitly — don't average them.

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
