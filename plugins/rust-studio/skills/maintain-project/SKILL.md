---
name: maintain-project
description: "Perform an explicitly requested dependency addition, improvement experiment, migration, crate scaffold, or worktree cleanup."
disable-model-invocation: true
---

# Maintain a project

Select with `--mode <operation>` or infer it from the explicit natural-language request.
A selector identifies the operation; it does not grant authority for its effects.

1. Match the user's explicit operation and target to the table. A request for one operation
   does not authorize the other four. With no target, inventory what is available and ask
   only for the missing choice. This entry and its operations cannot be model-invoked.

   | Operation | Load | Effect and completion contract |
   |---|---|---|
   | `dependency` | `references/procedures/maintenance-dependency.md` | Vet first; add the approved dependency and verify graph/build |
   | `improve` | `references/procedures/maintenance-experiment.md` | Approved bounded experiment; measured checkpoints and recoverable rejects |
   | `migrate` | `references/procedures/maintenance-migration.md` | One edition or major dependency migration with semantic evidence |
   | `scaffold` | `references/procedures/maintenance-scaffold.md` | Requested crate files and workspace integration compile |
   | `worktrees` | `references/procedures/maintenance-worktrees.md` | Inventory first; remove only the approved, identified worktrees |

2. Read the selected procedure relative to this installed skill directory. Use
   `references/delegation.md` for execution roles and applicable domain profiles; an
   implementer owns writes, a separate reviewer/verifier supplies independent sign-off.
   Apply `references/elephant-workflow.md` when the change is substantive. Reuse current
   scope authorization; obtain missing consequential decisions before dependent writes.
3. Finish with files/actions, evidence, preserved or deferred work and COMPLETE / NEEDS WORK /
   BLOCKED. Only the approved improvement contract authorizes its local checkpoint commits;
   other publication actions need their own authorization. Memory writes remain subject to
   user/host permission.

Project operations work from bundled procedures. Plugin instruction-layer experiments also
need the Studio source checkout and its evaluation tools; report that prerequisite if absent.
