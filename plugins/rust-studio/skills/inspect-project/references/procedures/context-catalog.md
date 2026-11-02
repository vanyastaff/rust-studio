# Find an available workflow

Use the host's available-skills catalog as the live inventory. Group available entries by
outcome, or filter to the supplied topic. Use qualified names or exact skill paths when names
collide. Omit unavailable entries and do not inspect a project merely to print the catalog.

| Outcome | Entry |
|---|---|
| Context, memory retrieval, installation diagnosis | inspect-project |
| Versioned source research | research-topic |
| Architecture, API, domain, design experiment, specification | design-change |
| Implementation, diagnosis, repair, refactor, performance | implement-change |
| Code, API, security, design, memory or prose review | review-work |
| Acceptance, tests, coverage, mutation, fuzzing, MSRV | verify-work |
| Decisions, changelog, memory capture, handoff | write-docs |
| Environment, CI and testing configuration | configure-tooling |
| Explicit dependency, migration, scaffold, improvement or cleanup work | maintain-project |
| Explicit plugin evaluation or status-line maintenance | maintain-studio |
| Explicit commit, PR or release operation | publish-change |

The five execution roles are researcher, designer, implementer, reviewer and verifier.
Explain role versus domain profile using `references/agent-roster.md`. Profiles supply domain
checks; the chosen role determines allowed actions. Different fresh worker instances establish
independence. When named workers are unavailable, use `references/sub-agents.md` and label any
required independent pass unverified.

Explain the workflow only as needed: `references/elephant-workflow.md` links context, durable
design, fresh design review, implementer reconstruction, integration and independent
acceptance. `references/coordination-protocol.md` owns gates and collaboration;
`references/working-preferences.md` owns operating preferences;
`references/memory-protocol.md` owns verified recall and authorized capture.

Complete when the requested catalog/topic subset is shown with operation effects and
explicit-only boundaries. Recommend inspect-project orient for a project-specific next step
or diagnose-host for delivery trouble. A catalog response never dispatches an explicit-only
entry on the user's behalf.
