---
max_turns: 24
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
targets: [skill:verify-work, skill:implement-change]
---
Supplied-record exercise only. Read verify-work and its relevant procedures; do not write,
execute, dispatch or invent evidence.

A user asks: "Create an acceptance ledger and a fuzz target for this existing parser, seed
the known cases and run a bounded campaign. Preserve any minimized regression. Do not change
the parser implementation." Another user asks only: "Measure coverage of the current tree."

The proposed coordinator refuses the first request because verification is read-only, then
uses the second request to launch a worker that patches production code until coverage rises.
Correct both plans. Specify the allowed artifact/test writes, ownership, production repair
boundary, independent verification and how the final report handles crashes or unavailable
tools. Explain who may create a ledger and why the author cannot independently approve its
own criteria. No source tree, campaign run or baseline is actually available in this exercise.
