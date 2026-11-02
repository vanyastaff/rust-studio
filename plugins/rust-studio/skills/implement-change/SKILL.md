---
name: implement-change
description: "Implement Rust changes, diagnose failures, resolve compiler or PR feedback, and prove refactors or optimizations with the checks their risk requires."
---

# Implement a change

Select with `--mode <operation>` or infer the operation from the user's natural-language
request. `--plan` remains a plan-only flag. A selector changes routing, not authorization.

1. Identify the requested outcome, scope and effect. Diagnosis-only ends at findings;
   design-only and `--plan` end at artifacts. Existing implementation authorization carries
   through in-scope repair and verification. Flags and findings grant no extra authority.
2. Select the procedure below; combine it with the delivery procedure for authorized source
   work. Read paths relative to this installed skill directory. Select the execution role
   from `references/delegation.md`, then load the applicable domain profiles. A profile
   supplies domain rules; it cannot make a writer an independent reviewer.

   | Operation | Load | Completion evidence |
   |---|---|---|
   | `implement`, `plan`, `test-first`, `repair-gate` | `references/procedures/change-delivery.md` | Integrated checks, plan only, red/green, or bounded gate result |
   | `diagnose`, `compiler`, `intermittent` | `references/procedures/change-diagnosis.md` | Reproducer, causal evidence and requested repair checks |
   | `performance`, `size` | `references/procedures/change-optimization.md` | Comparable measurements or an explicitly unmeasured diagnosis |
   | `refactor` | `references/procedures/change-refactor.md` | Pinned behavior, unchanged tests and current gate |
   | `conflicts`, `pr-feedback` | `references/procedures/change-integration.md` | Intent-preserving resolution or dispositions and current PR evidence |

3. Complete the selected operation within its effect boundary. Source writes belong to an
   implementer; research, design, review and verification use their respective roles.
   Substantive work follows `references/elephant-workflow.md`, the single lifecycle owner.
   Missing fresh-worker capability leaves required independence unverified.
4. Report outcome, actual commands/results, destination, unresolved work and external state
   separately. End COMPLETE / NEEDS WORK / BLOCKED with the operation's completion evidence.
   Memory capture requires the user's or host's authorization.

Explicit-only project maintenance, studio maintenance and publication remain human choices.
Do not invoke them automatically or perform their operations through this entry: adding a
dependency, starting an improvement campaign, edition/major migration, scaffolding a crate,
worktree removal, publishing, or a new commit/push mandate requires its own explicit scope.
PR monitoring or a repair request alone does not authorize posting replies, resolving threads,
committing, pushing or merging.
