---
name: design-change
description: "Design Rust changes: explore approaches, clarify requirements, define architecture or APIs, model domains, plan tests, and run disposable experiments."
---

# Design a change

Use `references/elephant-workflow.md` for the shared context, design, fresh review and
handoff lifecycle. Select `--mode <mode>` or infer the operation from the request, then load
only its procedure. `--mode explore` selects exploration; `--explore` is the equivalent
flag within specification mode:

| Requested outcome | Mode | Procedure |
| --- | --- | --- |
| Durable specification or comparison of approaches | specification, explore | `references/procedures/design-specification.md` |
| Crate boundaries, dependency direction, ownership | architecture | `references/procedures/design-architecture.md` |
| Public types, traits, signatures, error contracts | api | `references/procedures/design-api.md` |
| User-owned requirements or consequential choices | clarify | `references/procedures/design-clarify.md` |
| Domain states, invariants, or an outgrown type | domain | `references/procedures/design-domain.md` |
| A design doubt that requires running code | prototype | `references/procedures/design-prototype.md` |
| Criteria, cases, property laws and test strategy | tests | `references/procedures/design-tests.md` |

The coordinator records requested design artifacts. A designer is read-only. Choose roles
by the action and independence required, then load the applicable domain profiles under
`references/profiles/`. Role and host capability rules are in `references/sub-agents.md`.
A requested prototype uses a scoped implementer and explicit disposable paths.

Explicit design-only, exploration-only, interview-only and test-plan-only requests end at
their requested artifacts and evidence. They do not authorize production source writes.
Existing implementation authorization continues through `/implement-change`, or the bundled
Elephant phases when sibling skills are unavailable. Report artifact paths, decisions,
review coverage and unresolved evidence with COMPLETE / NEEDS WORK / BLOCKED for the
requested scope. Prototype experiments also retain SETTLED / INCONCLUSIVE.
