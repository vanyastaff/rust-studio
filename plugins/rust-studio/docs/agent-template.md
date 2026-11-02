# Agent authoring contract

The installed catalog has five singular role nouns: researcher, designer, implementer,
reviewer and verifier. Add domain expertise to canonical profiles, not new personas.
`catalog.json` owns roles, model classes and profile paths. Every agent file uses matching
name/frontmatter and a concise behavioral brief.

## Role and effects

Researcher, designer, reviewer and verifier are read-only for project sources. Implementer
writes only explicitly assigned paths within authorized scope. Shell access does not expand
that boundary. Running a check may create ordinary build output; it does not authorize repair.
The coordinator can record requested context, design, task and verification artifacts directly.

Requested prototypes/tests/fuzz targets use implementer with explicit paths and expected
observations. A designer stays read-only, and a different fresh verifier checks the result.
Load every applicable profile before applying domain checks. Profiles are role-independent
knowledge and cannot override permissions or models. Missing required content blocks that lens.

## Brief shape

State action/outcome, source and artifact paths, applicable profiles/project instructions,
constraints, write zone, acceptance commands/expected results and output verdict. Keep Rust
tutorials in references, and reference rules instead of copying standards. Assume expertise;
encode judgment, boundaries and evidence requirements.

Use researcher=haiku, implementer=sonnet, and designer/reviewer/verifier=inherit. Model/effort
choices remain host/user controlled (`references/model-routing.md`). Do not add a provider ID
or a profile-specific model override. Read-only role tool declarations must exclude write/edit
capabilities; the behavioral boundary also covers mutations through command tools.

## Independence and output

A fresh instance with controlled inputs establishes independence, not a renamed role. Never
feed an author defense or desired verdict to a review lens. For substantive work follow
`references/elephant-workflow.md` and the specific design/acceptance input boundary. Without
isolation, report useful analysis plus the required unverified check.

Return the actual deliverable, then its verdict and evidence. A researcher returns the map or
answer, not merely a claim that it was produced. Reviewers return actionable findings and
coverage; verifiers distinguish executed results, supplied logs and static inspection.
Preserve independent verdicts verbatim when relaying them, explaining disagreements rather
than converting a blocker to a pass (`references/verdicts.md`).

Ask for conclusions, evidence and a concise explanation, not hidden chain-of-thought. Describe
observable criteria rather than generic self-checking reminders. Give a short progress update
when findings or direction change; the final response must stand on its own.

Use semantic navigation when available, rg otherwise, and primary sources for external facts.
Name capability gaps and authorized fallbacks (`references/tooling.md`). A refused action
cannot be made authorized by routing it through a different worker or tool.
