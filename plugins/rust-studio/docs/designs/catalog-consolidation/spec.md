# Catalog consolidation

Status: Done. Date: 2026-11-02.

The user considers 59 skills and 33 agents excessive and requests stronger consolidation
with better names following an applicable standard. Preserve the completed Elephant workflow
and executable evidence checks while reducing discovery and duplicated orchestration.

## Decision

Use 11 public skills and 5 agent roles as exhaustively mapped in `catalog.json`. Skill names
use imperative verb-object syntax; agents use singular role nouns. This is Studio's convention,
not a mandatory industry taxonomy. Agent Skills requires lowercase/hyphen names of 1-64
characters matching their directory. Anthropic recommends consistency, considers gerunds and
explicitly accepts action-oriented names. See https://agentskills.io/specification and
https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.

Alternatives: nine entry points hid research and plugin maintenance inside unrelated outcomes;
16 or 18 preserved more independent commands but left avoidable selection burden. Eleven
separates research, plugin-only operations and publication while sharing ordinary implementation.

Skills identify user outcomes. Their short entry documents select canonical disclosed
procedures. Agents identify execution responsibility: researcher, designer, implementer,
reviewer, verifier. Profiles preserve domain invariants, real consumer checks and named gates
without remaining installed personas. Separate fresh worker instances establish independence;
a role or profile name cannot do so. Read-only CLI review remains read-only.

`catalog.json` also assigns every legacy capability a named operation mode under its new
owner. Modes can be inferred from an explicit request; flags do not grant authority. Each
entry documents its effect and completion contract, and its capability audit names the
canonical procedure that implements each operation.

Verification defaults to checks. Explicit ledger creation and test/fuzz-target authoring are
separate requested artifact/test outcomes, not production repair. The coordinator can write
a requested ledger; an implementer authors requested tests, and a separate fresh verifier
judges the resulting evidence. Production repairs use implement-change and retained repair
history. Coverage measurements do not silently authorize source changes.

The designer remains read-only. A requested throwaway prototype is assigned to an implementer
with explicit disposable paths and experiment criteria; findings return to the same design.
Its cleanup preserves unrelated work. A prototype cannot become an unreviewed production patch.

Profiles are reusable domain knowledge. Select the execution role from the requested action
and independence requirements, then load applicable profiles. Async review uses a fresh
reviewer with the async profile; async implementation uses an implementer with that profile.
Documentation authored by an implementer cannot supply independent API/RELEASE sign-off:
a different reviewer/verifier checks the applicable documentation criteria. The legacy agent
map is a default migration aid, not an exclusive domain owner or an authority grant.
The catalog declares canonical profile files; missing required profiles block that lens.
Preserve existing model-routing classes: researcher uses haiku, implementer sonnet, and
designer/reviewer/verifier inherit. Profiles never override models. Existing optional local
alias routing remains supported; no provider model is imposed on Codex by default.

## Required migration

- Preserve every existing capability through a named procedure or an explicitly documented
  merger. Remove weak routing/clerical stages instead of copying 59 complete prompts into
  hidden directories. One owner for lifecycle, repair count, acceptance and domain rules.
- Preserve the existing ten explicit-only skill sources within maintain-project,
  maintain-studio and publish-change. The last two remain different operational scopes.
  Model-discoverable branches never invoke those entries or bypass their authorization.
- Keep review/diagnosis/verification read-only unless the user actually requested repair.
  Remember/session capture continues to respect host/user authorization for memory writes.
- Rewrite maintained consumers, helper destinations, hooks, generators, validators, evals,
  fixtures and catalogs. Preserve historical reports as dated evidence; do not invent passes.
- Legacy task role labels resolve to the new role plus profile without rewriting historical
  provenance or resetting status/repairs. Historical usage retains original events and can
  aggregate through the migration map. No installed old-name wrappers or aliases remain.
- Old Codex generated agents require ownership-aware retirement: remove only unchanged
  previously generated files; preserve user-customized or unknown definitions and report them.
- Standalone skills retain all required procedures, profiles and executable imports. The
  plugin-only maintenance entry clearly states its host/source requirements.

## Acceptance

Exact 11/5 on-disk catalog; unique/exhaustive migration mapping; standard-compliant names;
no active dispatch to removed names; unchanged effect/freshness boundaries; runnable portable
helpers; regenerated references/metadata; applicable Bun and distribution/host checks pass.
New routing evaluations cover diagnosis-only, design-only, explicit operations, specialist
profile selection and cold implementation handoff. Preserve previous live evidence as historical;
exercise the renamed public lifecycle with a fresh worker rather than relabeling that evidence.
