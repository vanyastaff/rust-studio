# Elephant-Goldfish Model: independent design review

Reviewed 2026-11-02 against upstream commit
[`403d8881d62022490637d740657b33f01e321ea8`](https://github.com/google/elephant-goldfish-model/commit/403d8881d62022490637d740657b33f01e321ea8).
This is a source comparison, not a local execution of EGM or a claim about its latest release.

EGM separates the agent that develops a design with project history from reviewers given
only the document and selected references. Its contribution is an explicit input boundary
and a review of what a new reader can reconstruct. The
[architecture](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/docs/designs/architecture.md)
also treats specifications as checked-in artifacts that can be compared with implementation.
Studio already has durable specs, specialist reviews and independent acceptance; importing
another complete workflow would duplicate those owners.

## Useful mechanisms and their local owners

| Upstream mechanism | Existing Studio behavior | Adaptation |
|---|---|---|
| [Fresh reviewer dispatch](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/docs/codex.md) explicitly disables inherited turns, supplies artifact paths and checks completion/read evidence. It distinguishes conversation isolation from shared filesystem and memory. | [Blind acceptance](blind-acceptance.md) already isolates original user requirements from the implementation spec. [Document review](../skills/doc-review/SKILL.md) needs a similarly explicit boundary for design readers. | Strengthen `/doc-review` with fresh reviewers for substantive designs, a neutral input packet and an honest unverified outcome when isolation or required reads cannot be established. Keep blind acceptance's different input boundary. |
| [Comprehension reviewer](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/agents/comprehension.md) first paraphrases the proposal and existing system, then reports gaps. General software vocabulary is assumed; project-specific knowledge is not. | `/doc-review` checks contradictions and unstated assumptions but its findings-only output can discard evidence of a mistaken interpretation. | Retain both paraphrases even when the reviewer reports no defects. Compare them with the document's stated intent; a plausible paraphrase is not proof that the design works. |
| [Review pipeline](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/skills/egm-review/SKILL.md) separates feature design from implementation planning and checks simplicity again after criticism adds mitigations. | [Spec](../skills/spec/SKILL.md) and task planning already have separate owners. `/doc-review` selects domain lenses. | Review decisions at their proper level. After repairs, recheck whether mitigations introduced redundant components, speculative scope or boundary violations. Avoid imposing five stages on every short document. |
| [Review loop](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/skills/egm-review-loop/SKILL.md) preserves finding provenance and treats failed reviewers as not run rather than clean. | [Review repair](review-repair.md) already defines stable IDs, dispositions, evidence, three repair dispatches and incomplete outcomes at the limit. | Keep the local repair owner. Record reviewer identity, reviewed inputs, completion and unresolved findings in the document report; deduplication must preserve provenance. |
| [Drift report](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/skills/egm-drift-report/SKILL.md) reads checked-in documents and corresponding source to find divergence in both directions. | [Spec verification](../skills/spec-verify/SKILL.md) proves completion of an existing task spec; it is not a maintenance review of arbitrary design docs and READMEs. | Add `/doc-review --drift`: compare claims with current symbols, callers and tests, distinguish obsolete docs from missing implementation, and report coverage gaps. Keep it read-only for reviewed sources. |

## Make the reviewed revision observable

An explicit file list with content hashes gives the review a reproducible input identity.
The local `review-packet.ts` helper captures selected UTF-8 documents and reference files,
then checks whether those files are unchanged, missing or modified before a verdict is reused.
Its output goes to stdout; callers choose any artifact destination.

This helper is a Studio adaptation, not an upstream component. It proves only the identity
and freshness of the listed bytes. It cannot prove that the list is complete, that a worker
read it, that the host isolated the worker, or that any finding is semantically correct.
Additional source reads must be recorded rather than silently treated as part of the initial
packet. A changed artifact needs a current review before its old verdict can be reused.

For drift review, a name missing at its former path is a lead, not sufficient evidence of a
missing feature: trace renamed symbols and current callers. An unimplemented draft is not a
regression against an adopted contract. A stale document can be wrong while the implementation
is right. Unread scope remains unverified; a partial inspection cannot claim repository-wide
consistency.

## Choices not imported

- EGM's [bootstrap](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/skills/egm-bootstrap/SKILL.md)
  generates directory contracts bottom-up and excludes test files from source extraction.
  Studio's [crate context template](templates/crate-context.md) deliberately avoids repeating
  manifests, rustdoc and root rules. Keep those authoritative locations and inspect tests
  when they provide contract evidence; do not generate a second documentation tree.
- The review loop requires two consecutive clean rounds and caps at five. Its settled-finding
  rule can suppress recurring contested issues. Retain Studio's evidence-based dispositions
  and bounded repair policy; reaching a cap never makes an unresolved blocker acceptable.
- The pipeline can record residual findings as accepted trade-offs after a re-audit limit.
  A budget limit does not supply user acceptance. Preserve unresolved decisions explicitly.
- EGM's [resolver](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/skills/egm-resolve/SKILL.md)
  usefully requires a contest to cite evidence a reviewer could inspect. Its repeated
  interactive gates are not required for Studio work already authorized by the user.
  Findings alone do not authorize edits during a read-only review.
- EGM's fixed report filenames and long mandatory prose rules are not copied. Use the
  existing task/artifact location and preserve prior reports when recording a new revision.
  The adaptation adds no new skill, persona, memory store or background monitor.

## Verification boundary

Upstream's [testing record](https://github.com/google/elephant-goldfish-model/blob/403d8881d62022490637d740657b33f01e321ea8/TESTING.md)
separates offline packaging checks from opt-in native host runs. It requires native launch,
read and completion records, and reports cloud verification gaps separately. Those are
upstream-reported results, not tests executed for this study.

Studio's helper tests can prove input validation, byte identity and freshness diagnostics.
Distribution validation can prove that skills ship their references and helpers. Neither
establishes live reviewer independence, review quality, fewer defects or lower token cost.
Those claims require separate host traces and representative design-review evaluations.

## Initial Goldfish verification (before Elephant extension)

The implementation is integrated into the existing `doc-review` and `spec` skills; generated
references and standalone helper copies are rebuilt by the normal distribution pipeline.

- Public CLI tests cover exact text/digest preservation, changed and missing inputs, malformed
  inventories, root escapes, symlinks, encoding, per-file/total size limits, and relocation to
  another checkout. A FIFO regression reproduced a hang (outer timeout exit 124); the helper
  now rejects non-regular inputs before opening and uses a nonblocking open for replacement
  races. All 22 helper tests pass on Linux. Windows passes 20, with the Unix symlink/FIFO
  tests explicitly skipped.
- The complete Linux Bun suite passes 726 tests, with 5 existing skips and no failures;
  distribution/prose/reference validation passes. The native
  Claude plugin validator and pinned agnix validator report no errors or warnings. Linux
  checks use an isolated LF checkout; the Windows CLI checks use the actual working tree.
- Two fresh workers separately answered `doc-review-fresh-evidence` and `doc-review-drift`
  without access to their graders. Manual comparison against the checked-in rubrics found
  all required distinctions, including inherited-context invalidity, unavailable reviewers,
  stale evidence, unresolved findings at the cap, preserved re-exports and platform limits.
  These are supplied-record instruction evaluations, not native `claude plugin eval` runs
  or proof that every supported host enforces worker isolation.
- Final affected review: `harsh-critic: READY — SURVIVES`. The preceding round found a GNU
  `timeout` dependency in the FIFO test; a Bun child-process kill timer replaced it. The
  remaining advisory notes concern deadlines on ordinary test subprocesses and the limit of
  the FIFO evidence: it proves rejection of an existing FIFO, not an injected stat/open race.
  macOS execution was not performed. The final nine-file review packet checked CURRENT.

No EGM implementation, authenticated review service or automatic semantic drift detector is
installed. The semantic review remains an agent workflow; the helper checks the listed bytes.

## Elephant extension

The completed lifecycle now integrates the context-rich author, durable spec, fresh Goldfish
review and fresh implementation reconstruction through `/dev-task` and `/spec`.
See [the workflow](elephant-workflow.md), [catalog consolidation](elephant-consolidation-2026-11.md)
and [release verification](designs/elephant-workflow/verify-report.md). New designs are versioned
under `docs/designs`; existing local designs remain supported in place. The two redundant
planning entry points were retired rather than adding parallel Elephant skills.

The executable handoff helper reuses the byte snapshot and task parser. It requires a reserved
active task and explicit context, original intent, design review and sources. A fresh worker
reconstructs those artifacts before writing and checks CURRENT immediately before its first
source edit. This does not itself prove source inventory completeness, semantic readiness,
actual worker isolation, or authorization. Those remain explicit coordinator responsibilities.
