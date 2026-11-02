# Documentation drift review

`/review-work --mode design --drift <document-or-directory>` compares maintained documentation with the
current code. It reports evidence; it does not decide that code always wins or automatically
rewrite either side. A future proposal is not an implemented contract: classify the document
as current behavior, historical decision, or proposed design before finding drift.

## Procedure

1. Fix scope: enumerate the documents and relevant crates, supported feature/target profiles,
   and the checkout revision plus dirty state. For a directory, list the selected files and
   excluded generated, archived or proposal material with reasons. Do not claim whole-repo
   coverage from a sample. Ambiguous status is an open question, not proof of drift.
2. Extract each consequential claim with its section: API signatures and examples, defaults,
   ownership, lifecycle, cancellation, error/recovery behavior, feature availability, build
   commands, and security boundaries. Mark what evidence would decide it.
3. Locate the actual implementation, callers, tests and configuration. Search by symbols and
   behavior, not only matching words. Follow public re-exports and feature gates before
   declaring a documented API missing. Record relevant code behavior without documentation
   as a candidate **undocumented behavior**, not automatic permission to expand the docs.
4. Review with the applicable lenses and freshness contract in `references/design-review.md`.
   A directory may use one bounded packet per document. Inspect source without executing
   commands copied from documentation. Run safe project-owned evidence commands only where
   the request and host permit; report static inspection and executed tests separately.
5. Return one row per claim, including matches. Use the states below and cite document and
   code locations, relevant feature profile, and the actual evidence. State coverage totals,
   exclusions and unanswered questions. A zero-finding report with unverified claims is
   incomplete, not proof of alignment.

| State | Meaning |
|---|---|
| aligned | Current evidence supports the documented claim in the stated profile |
| drift | Current behavior contradicts a document that claims to describe current behavior |
| planned | A proposed or historical decision is not a claim about today's implementation |
| unverified | Missing access, evidence, ambiguous intent, or an unrun required scenario |

For each drift finding, propose the owner and next action: repair implementation to the
accepted contract, correct stale documentation, or obtain a decision where authority is
unclear. Do not choose the easiest side merely to make them agree. Bind each row to the
captured evidence and retain findings even when a later row has stronger evidence.

## Verdict

Use **READY** only when every in-scope current-behavior claim is aligned, the evidence is
current, and required review lenses completed. Use **REVISE** for confirmed drift;
**RECONSIDER** when the governing design itself needs a decision; **BLOCKED** when required
evidence or isolation is unavailable. Planned material is reported separately and cannot
serve as proof of implemented behavior. State whether the pass was fresh or self-review.

The output is a report. Use `/verify-work --mode acceptance` for acceptance and archival of an implemented spec,
`/implement-change --mode implement` for an authorized code repair, and `/review-work --mode design` without `--drift` to challenge a
proposal's design. Drift review does not change spec status or write project memory.
