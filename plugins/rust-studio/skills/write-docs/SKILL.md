---
name: write-docs
description: "Write an architecture decision, release changelog, authorized durable learning, or session handoff from project evidence."
---

# Write docs

Write only the artifacts requested or already authorized. Select `--mode <operation>` or
infer the operation from the request, then read
its procedure before drafting; a mode flag is not permission for additional effects.

| Artifact | Operation | Procedure |
|---|---|---|
| Architecture decision record | decision | `references/procedures/writing-decision.md` |
| User-facing release notes | changelog | `references/procedures/writing-changelog.md` |
| Durable project learning | memory | `references/procedures/writing-memory.md` |
| Session recap and continuation record | handoff | `references/procedures/writing-handoff.md` |

Use the existing project context and artifact location. Preserve unresolved decisions and
separate recorded decisions from implemented behavior. Memory writes require user and host
authorization; a handoff request alone does not grant it. Draft-only requests end at the draft.

The coordinator may write requested documents directly. Use `references/delegation.md` and
`references/sub-agents.md` when source filtering or independent judgment earns delegation.
An implementer with the documentation profile may author documents; a different reviewer or
verifier supplies any required API-GATE or RELEASE-GATE sign-off. Continue already-authorized
implementation through `references/elephant-workflow.md` after completing the artifact.

Report the artifact paths, evidence, remaining decisions and COMPLETE / NEEDS WORK / BLOCKED.
