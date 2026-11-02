# Record an architecture decision

Record one consequential choice in the existing context/design. Use
`references/collaboration.md` for authorization and `references/elephant-workflow.md` for
the shared lifecycle. A settled decision remains settled; an ADR-only request authorizes
the record, not its implementation. If the topic is absent, inspect supplied context before
asking what choice needs recording.

## Establish the choice

Recall prior or conflicting decisions using `references/procedures/context-recall.md`.
Inspect related source, tests, manifests and supplied tickets/discussions. Use symbol
navigation where available and `rg` for cfg/macro sites. State one decision, constraints,
non-negotiables, quality attributes, related ADRs and relevant gates. A larger unresolved
design uses design-change within the same artifact context.

For an unsettled decision, compare two to four options under
`references/maintainer-grade-development.md`. Each records concrete benefits/costs,
codebase-specific trade-offs, structural encoding of invariants, and the two-year or three
likely extensions view of responsibility. Include failure/abuse cases, especially at untrusted
input or cross-crate trust boundaries. Assess performance, unsafe, API surface, async topology,
MSRV and edition compatibility when affected. Cite checked versioned sources for ecosystem
claims or state the last-verified version and uncertainty.

Use a designer with the architecture and applicable domain profiles for consequential
judgment. For boundary-moving, cross-crate or new-primitive choices, obtain fresh adversarial
review under `references/design-review.md`; fold real findings into the options. Preserve
the maintainer pre-code verdict **ACCEPTABLE / RESHAPE NEEDED / BLOCKED**, including ownership,
existing sibling primitives, reuse/reinvention, maintainer objections and permitted breaking
changes. Reshape options before advancing. Missing prerequisites remain visible; preserve
the draft and offer explicit assumptions, deferral or a split decision when needed.

## Write the record

Use `references/templates/adr.md`: Context, Decision, Consequences and Alternatives, including
rejected options and reasons, review findings and the pre-code verdict. Start unresolved work
as Proposed. Mark Accepted only when the choice is settled within existing authorization.
Documenting a historical decision distinguishes evidence from inferred rationale and cannot
invent historical review passes. Acceptance records a decision, not shipped implementation.

Follow the project's ADR location; the default is `docs/adr/<NNNN>-<slug>.md`. Choose one above
the highest existing numbered ADR, starting at 0001; use a lowercase hyphenated title slug
without punctuation. Recheck numbering before writing if concurrent edits are possible.
Link the parent context/spec and related decisions. Apply available prose checks as advisory
feedback and fresh review for substantive designs under `references/design-review.md`.
An explicit draft-only request stops at the draft. Ask only for unresolved consequential
user-owned choices or genuinely missing authority.

Completion requires a written record or requested draft with status, evidence, alternatives
and open decisions. Report path, decision, affected gates and follow-on work with
**COMPLETE / NEEDS WORK / BLOCKED**. Preserve already-authorized implementation continuation;
memory capture remains independently authorized.
