# Specify or explore a change

This procedure specializes the context and substantive-design phases in
`references/elephant-workflow.md`. That protocol owns artifact resolution, original-request
provenance, review freshness, repair limits and implementation handoff. Keep one context
index and one spec across all specializations.

For `specification`, establish current behavior from source, real callers, tests and
configuration. Write the requested spec using `references/templates/spec.md`. A fresh
reader must derive concrete contracts, ownership/lifecycle, failure/recovery, consumer
migration, obsolete-path removal, constraints, alternatives and observable acceptance.
Preserve original quotations and ordered amendments separately from interpretations.

For exploration (`--mode explore` or `--explore` within specification mode), compare 2–4 meaningfully different
approaches where a real fork exists.
Measure reuse, coupling, implementation and maintenance costs, failure modes and likely
extensions. Resolve technical questions from evidence. Record a recommendation, rejected
alternatives, remaining uncertainty and any consequential user-owned decision. An
exploration-only request ends with that comparison; it does not manufacture a later
approval or implementation task.

For either mode, record the pre-code ACCEPTABLE / RESHAPE NEEDED / BLOCKED assessment
under `references/maintainer-grade-development.md`. Load architecture, API, async, security,
systems or performance profiles for the actual contracts involved. A designer contributes
read-only analysis, and the coordinator writes authorized artifacts. Fresh review follows
`references/design-review.md`, with findings corrected in the artifact and affected review
refreshed. Record unavailable evidence or isolation as unverified.

Completion means the requested comparison or reviewed specification is self-contained and
its unresolved decisions are named. Implementation proceeds only under existing authority
through the canonical Elephant lifecycle. Design recording does not authorize memory writes.
