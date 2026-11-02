---
name: review-work
description: "Review Rust changes, designs, security, dependencies, prose, or project debt against evidence and applicable gates."
---

# Review work

Produce findings against a fixed scope. Default effect: read-only, including every review
worker. A finding does not authorize repair, filing, memory mutation, or publication.
Use `references/verdicts.md` for severity, intensity and gate decisions, and
`references/integrity-and-evidence.md` for the evidence bar.

## Steps

1. Name the artifact, comparison baseline and requested outcome. For a diff, include staged,
   unstaged and relevant untracked files; for a document, distinguish current behavior from a
   proposal. Read applicable project standards from the actual tree. Record unavailable inputs.
2. Select `--mode <mode>` below from the requested action (natural-language requests may infer
   it), then read its procedure. Combine relevant
   lenses without repeating a scan. `references/delegation.md` and `references/sub-agents.md`
   govern worker use and host limitations. Choose a reviewer or verifier by the action, then
   load the applicable domain profiles; a profile never grants writes or independence.
3. Complete all selected lenses before merging their findings. Give independent workers raw
   scope and evidence, without the author's diagnosis or expected verdict. Preserve each
   worker's verbatim verdict, coverage and failed/not-run checks. A writer cannot independently
   sign off its own documentation, API or release work.
4. Return the procedure's report, commands/results, limitations and verdict in the final reply.
   Authorized fixes continue through `implement-change` and `references/review-repair.md`;
   retain finding identities and repair history. A review-only request ends with findings.

| Mode | Requested outcome | Procedure |
|---|---|---|
| `diff` | Correctness, standards, tests and maintainer shape | `references/procedures/review-code.md` |
| `api` | Public surface and SemVer impact | `references/procedures/review-code.md` |
| `scope` | Diff or plan against acceptance criteria | `references/procedures/review-code.md` |
| `design` | Design decisions; `--fresh` isolation or `--drift` against code | `references/procedures/review-documents.md` |
| `prose` | Deterministic sentence-level findings | `references/procedures/review-documents.md` |
| `soundness` | Every unsafe site and SAFETY-GATE | `references/procedures/review-risk.md` |
| `security` | Application and supply-chain security | `references/procedures/review-risk.md` |
| `dependencies` | Existing dependency health and resolution | `references/procedures/review-risk.md` |
| `structure` | Technical debt and structural drift | `references/procedures/review-structure.md` |
| `memory` | Store integrity, freshness, budget and proposed maintenance | `references/procedures/review-structure.md` |

## When NOT this skill

- Shape a future design or API: use `design-change`; this skill audits the supplied decision.
- Prove delivered behavior or run test campaigns: use `verify-work`; review findings alone
  do not establish acceptance.
- Repair production code: use `implement-change`. For requested prose edits, apply the
  distinct writing action in the prose procedure and re-run its gate; review mode stays read-only.
- Add a dependency or publish: suggest the relevant explicit `maintain-project` or
  `publish-change` operation to the user; review cannot invoke those operations implicitly.
