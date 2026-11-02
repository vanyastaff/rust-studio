# Review documents and prose

## Design decisions and drift

Resolve the named document or the most recently changed design/ADR/document when no path is
given. A design slug searches docs/designs/ and legacy .rust-studio/specs/; competing matches
require an explicit path. State whether it describes current behavior, a historical decision
or a proposal.

Read `references/design-review.md` and follow its Goldfish protocol for substantive designs
or --fresh: that document owns isolation, evidence packets, comprehension, freshness checks,
finding dispositions and bounded rounds. `references/elephant-workflow.md` owns the surrounding
design lifecycle. Use the bundled `scripts/review-packet.ts` exactly as documented there;
CURRENT only establishes byte identity for inventoried files, not completeness or correctness.

Before dispatch, identify duplicated passages, obsolete change-history narration and private
process IDs that prevent a new reader understanding the current contract. Review decisions,
not sentence style. Select relevant reviewer lenses with these profiles:
`references/profiles/adversarial.md`, `references/profiles/architecture.md`,
`references/profiles/security.md`, `references/profiles/testing.md`; add
`references/profiles/api.md`, `references/profiles/async.md`, `references/profiles/systems.md`
or `references/profiles/performance.md` where the proposal enters those domains.

Each lens tests the premise, alternatives, ownership/recovery, consistency, scope/sequence,
threat model and falsifiable acceptance within its domain. Preserve comprehension even with
zero findings; divergent readings are evidence of ambiguity. Reconcile under the canonical
protocol and quote verdicts verbatim. The result is READY / REVISE / RECONSIDER / BLOCKED,
with completed/failed/not-run coverage and missing evidence, not merely a finding count.

For --drift, read `references/document-drift.md` and apply its claim-by-claim procedure to
source, callers, tests and configuration. It owns aligned/drift/planned/unverified states,
scope exclusions and freshness. Static inspection and execution are separate evidence.
Do not choose whether code or docs must change just to make them agree. Review-only work
returns findings; authorized design corrections refresh the affected review under the same
lifecycle. Delivered acceptance belongs to `verify-work` in acceptance mode.

## Prose

Read `references/prose-gate.md` for deterministic rules and `references/prose.md` for register.
Select one scope: --full (default), --since <rev> for changed sentences, or --stdin for a draft.
For a visitor-facing whole page use --density 100. Run bundled scripts/prose-gate.ts with Bun
and absolute input paths; it examines Markdown and Rust doc-comment text, not Rust code.

Relay the metric line, every file:line rule/severity/excerpt and fix line, and the summary
verbatim. COMPLETE means no errors, with warnings retained; NEEDS WORK lists errors; exit 2
is BLOCKED with the reported reason. A successful prose gate says nothing about a document's
argument or implementation correctness.

A request to check prose leaves the author's text unchanged. An explicit request to edit it
is a separate writing action: assign an implementer with `references/profiles/documentation.md`
the requested sentences and scope, then rerun the deterministic gate. Broader requested
documentation artifacts use `write-docs`. The author cannot independently provide API-GATE
or RELEASE-GATE documentation sign-off on that edit.
