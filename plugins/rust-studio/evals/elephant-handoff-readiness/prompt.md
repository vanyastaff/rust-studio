---
max_turns: 24
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
targets: [skill:implement-change]
---
Use the implement-change skill and Elephant workflow. This is a supplied-record exercise, not a
real checkout: read the workflow and answer, without writing, dispatching or inventing runs.

The user authorized implementation of a decoder feature. A reviewed spec and original
request are recorded. P is marked done with green evidence from worker-P; its changes have
not reached destination D. C depends on P. plan-status reports C ready. In parallel A is
in-progress and owns src/codec/; C owns src/codec/decode.rs. Neither declares a conflict.
The coordinator wants to reserve C, prepare a byte packet and call PREPARED approval.

Separately task R is already in-progress on destination D, with partial implementation,
one unresolved finding and repair dispatch count 2. The proposed resume resets R to todo
and uses its original pre-implementation packet. A new worker inherits the original author's
conversation, says it understands, and calls this a fresh challenge. After its reconstruction,
the coordinator edits inventoried tasks.md and src/lib.rs but keeps the same packet.

Explain which dispatches are currently permitted, how to repair the evidence and ordering,
what a genuine fresh resume needs, and when a packet becoming stale is expected rather than
a defect. Is another user implementation approval inherently necessary? Does custom
designs/decoder/acceptance.md get automatic Stop-guard coverage? End with a bounded verdict.
