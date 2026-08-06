---
name: worktree-sweep
description: "Use when inspecting and pruning leftover git worktrees (agent-isolation leftovers included) — per-worktree dirty/merge status, removal only on explicit approval."
disable-model-invocation: true
allowed-tools: "Bash(git worktree*) Bash(git -C*) Bash(git status*) Bash(git branch*) Bash(git log*) Bash(git rev-list*) Bash(du *)"
---

# /worktree-sweep — inspect and prune leftover git worktrees

Linked worktrees leak. Agent-isolation worktrees (`agent-*` checkouts created for
sub-agent work) are the usual accumulators: each is a full copy of the tree, they eat
disk by the gigabyte, and repo gates that scan the filesystem (inventory checks,
spell-checks, grep-based scripts) trip on their stale copies. This skill makes the
leftovers visible and prunes them safely.

## Steps
1. **Inventory.** `git worktree list` — the FIRST entry is the main worktree; it is
   never touched. For every linked worktree collect:
   - dirty state: `git -C <wt> status --porcelain` (empty = clean);
   - branch and unmerged work: `git -C <wt> log --oneline <base>..HEAD` against the
     repo's default branch (no output = branch merged or no unique commits);
   - unpushed commits when an upstream exists: `git -C <wt> log --oneline @{u}..HEAD`;
   - size (optional, can be slow on big trees): `du -sh <wt>`.
2. **Report** a table: path | branch | dirty? | unmerged commits? | size. Classify each:
   - **safe to prune** — clean AND no unmerged/unpushed work;
   - **needs decision** — dirty or carrying unmerged work: name what would be lost.
3. **Prune on explicit approval only.** Show the removal plan and get confirmation per
   worktree (or for the whole safe-to-prune set at once). Remove with
   `git worktree remove <path>`; a dirty worktree needs `--force` AND an explicit user
   acknowledgement that its uncommitted changes will be lost. Then
   `git worktree prune` to clear stale admin entries.
4. **Verify.** `git worktree list` again; report how many were removed and, when sizes
   were measured, the reclaimed disk space.

## Guardrails (hard)
- Never remove the main worktree. Never `rm -rf` a worktree — `git worktree remove`
  keeps git's admin state consistent.
- Never remove a worktree with unmerged or unpushed commits without an explicit
  per-worktree approval; list the commits that would be orphaned first.
- A worktree whose branch is checked out nowhere else and holds unique commits is
  someone's in-flight work, even if it looks old — report age, don't infer abandonment.

## Output
The inventory table, the removal plan, what was removed, and reclaimed space. Verdict
**COMPLETE / NEEDS WORK / BLOCKED** (blocked = worktrees exist but every candidate
needs a decision the user hasn't made).
