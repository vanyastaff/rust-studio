# Task evidence that survives an interruption

The spec's `tasks.md` remains the local source of task status. Per-task execution entries
hold evidence behind those rows; the host task surface is only a mirror. No new ledger,
background process or issue-tracker integration is required.

## Before dispatch: check the actual contracts

For tasks sharing a file or produced/consumed interface, compare the producer's promised
contract with the consumer's expectation and each task's tests. Record a short compatibility
row: producer → consumer → contract/source → compatible or concrete conflict. Include
semantics (units, absence/error meanings, ownership or event ordering) where they matter,
not just names. Use the approved spec and observed code as authorities; distinguish planned
interfaces from implemented ones. Resolve contradictions before dispatch, never silently
discard a requirement. Independent tasks need no speculative compatibility matrix.

## Record as each task progresses

Maintain one execution entry per task, linked to its status row:

- Source worker/worktree/branch and agreed integration destination.
- Commit plus relevant uncommitted-diff identity (include untracked source/config), or a
  recorded diff/artifact when commits are unavailable. A branch name is not a revision.
- Acceptance slice, commands/results, reviewed tree, active repair round and unresolved
  finding IDs. Missing results are unverified. Repairs follow `references/review-repair.md`.
- Discovered interfaces, decisions and constraints that later tasks need: a short fact,
  source pointer and affected task IDs. Record disagreements with the plan; update dependent
  briefs rather than relying on the worker's conversation surviving.
- Integration status and next concrete action. Record external tracker/PR status separately,
  including pending synchronization or pending merge.

Use pointers and short facts, not copied logs or secrets. Persist discoveries when they
affect the next task, not just at session end. The coordinator owns the shared record so
parallel workers do not overwrite each other. Project-wide durable decisions also use the
existing memory/ADR workflow; execution notes do not replace it.

## Resume by reconciling evidence, not replaying the plan

Read the row and execution entry, then inspect actual source and destination trees. Check
which commits/diffs landed, what remains uncommitted, and whether recorded commands/review
still cover the current tree. Preserve unrelated user work. Do not repeat implementation
because the host task list is empty, or trust a done row because a worker said COMPLETE.
Missing identity/round history stays unknown until recovered from durable artifacts; never
initialize a lost counter to zero.

A worker-tree pass is not destination-tree evidence. Integrate authorized work, resolve
conflicts by intent, then refresh affected checks in the destination. Conflict resolution,
interface changes and relevant dirty edits invalidate affected prior evidence. Reuse
unchanged checks only with a reason tying them to unchanged inputs; neither an automatic
full rerun nor automatic reuse of an old green is justified.

Mark a local task done and release its dependants only once implementation is present in
the agreed destination, required acceptance/review evidence is current, and dependent
contracts are reconciled. If blocked, record why and continue other ready tasks. Supply
dependants the discoveries and resolved contracts as part of their brief.

Local completion does not mean a remote issue was closed or a PR merged. Update an external
tracker only within existing authorization; otherwise record synchronization as pending.
For PR workflows, record verified work while merge is pending and let issue closure follow
the configured merge policy. An open tracker issue is not permission to redo work or close
it early. Report local integration/verification and remote state separately, with evidence.
