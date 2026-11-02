# Retrieve verified project memory

Resolve the store under `references/memory-protocol.md` and host instructions. Honor the
host's named directory and supported Studio memory_dir / RUST_STUDIO_MEMORY_DIR override.
For the shared Claude-format store fallback, derive the project key from the main worktree
root with non-A-Za-z0-9-hyphen characters replaced by hyphens, under
`~/.claude/projects/<project-key>/memory/`. A host-managed extraction store is governed by
its own write policy. Retrieval itself is read-only.

For an empty topic, summarize the index by kind, ranking by branch and changed files.
Otherwise search index titles/hooks and note bodies for topic words, paths and symbols.
Title/slug hits outrank body hits, and agreement across terms raises relevance. Consult
relevant agent-memory rulings when present. Read the highest-ranked few notes, not the store.

Before a note steers work, check referenced paths, symbols and flags against the current
tree; compare `git log -1 -- <path>` with modified/verified dates. Mark each **holds**,
**stale** with the change, or **unverifiable** with the missing evidence. Reuse a verified
note already in context. Stale notes cannot silently guide the plan; propose a correction or
use the authorized memory-writing operation. A recall request does not authorize editing.

Return a ranked list: title, kind, age, takeaway, freshness verdict and note path. State when
a finding changes the approach. No matches is a valid result; omit marginal notes. Completion
means every returned note has a freshness verdict and the task's relevant prior constraints
are accounted for. A broader audit belongs to review-work memory; future capture needs
separate user/host authorization.
