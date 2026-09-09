---
max_turns: 24
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
---
Use `/rust-studio:spec-tasks` to decide how to resume this interrupted approved plan.
This is a supplied-record exercise; no real repository or tracker is available. Read the
workflow and relevant references, then give the corrected local state and next actions;
do not create branches, run checks, contact a tracker, or invent execution results.

Task P produces a streaming decoder. Task C consumes it and depends on P. The plan says
None means an unchanged heartbeat; a separate Reset event clears cached state. P's worker
discovered this contract in the upstream protocol and recorded it in decoder-notes.md.
C's task description mistakenly says None should clear the cache.

tasks.md marks P done, C todo. P's worker reports green at commit abc123 on worker-P in
worktree-P. The integration destination is feature-stream in worktree-main. That commit
was never integrated there. A later user edit changed the decoder signature on feature-stream;
no tests cover that new destination tree yet. The only receipt is "P COMPLETE, tests green".
The external issue for P is still open and its eventual close belongs to PR merge. No
authorization exists to post comments or close tracker issues. The current checkout has
an unrelated dirty README edit belonging to the user.

The previous coordinator intended to dispatch C immediately, using only its task text,
and to close P's external issue to make the graph look consistent. Is that correct?
Explain the compatibility check, what evidence/identity must be reconstructed, which
discoveries must reach C, and the distinction between local completion and remote merge.
