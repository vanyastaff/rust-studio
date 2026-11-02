# Inventory and safely remove worktrees

An explicit inspection request permits inventory only. A cleanup request still needs an
identified removal set covered by user authorization; age and agent-like naming are not
evidence of abandonment. Keep the primary worktree and unknown or sole-copy work intact.

1. Read `git worktree list --porcelain` and identify the main worktree. For every linked
   checkout collect absolute resolved path, branch/detached HEAD, locks/prunable state,
   `git status --porcelain` including untracked work, unique commits against the default
   branch, and unpushed commits against upstream where present. A missing upstream leaves
   publication unknown. Optionally measure disk size, including nested targets.
2. Report path, branch, dirty state, unique/unpushed work and measured size. Classify a
   candidate as safe only with clean status and verified absence of unique/unpushed work;
   otherwise name the decision and exactly what would be lost. Do not infer that a branch
   checked out nowhere else is disposable.
3. Present a concrete removal set and reuse existing explicit approval only if it covers
   those paths and risks. Dirty removal requires explicit acknowledgment of losing the
   listed changes; unique/unpushed commits require per-worktree approval. Preserve unknown
   files and unpublished sole copies unless that destructive scope was explicitly granted.
4. Immediately before removal, recheck path identity, main-worktree exclusion and status
   against the approved inventory. On Windows resolve absolute paths and verify they stay
   within the named workspace/target; perform filesystem operations in one shell. Use
   `git worktree remove <path>`, with force only for its separately approved loss. Never
   recursively delete a checkout as a substitute for Git's worktree operation.
5. Run `git worktree prune` for authorized stale admin cleanup, then inventory again.
   Report removals, preserved candidates, failures and measured reclaimed space. Do not
   claim a size saving from an unmeasured estimate.

Inspection can be COMPLETE with a report and no deletions. Requested removal is COMPLETE
only for its approved set; pending destructive decisions remain BLOCKED with the preserved
paths named. Never remove the main checkout or delete a branch as an implicit extra step.
