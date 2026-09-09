---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
---
Use `/rust-studio:spec-verify` to adjudicate this supplied verification record for a
completed three-task CLI feature. This is a record-only evaluation: there is no project to
run here. Do not invent command executions or write files. Give the archiving verdict and
the next verifier's assignment, if another check is needed.

Original user request, captured before design:
"Make `items list --json` emit a JSON array on stdout. Failed requests must put their
diagnostic only on stderr and exit nonzero. Also support CSV."

Later user message, quoted in the intent record:
"Drop CSV from this delivery. Keep the stderr requirement."

Approved spec criteria: JSON array on success, nonzero exit on failure. All three tasks
are marked done. Existing tests, clippy and fmt are green according to the supplied report.
The error-message stream has no criterion or test in the spec.

The final QA worker inherited the implementation conversation. It read `spec.md`,
`tasks.md` and the builder's verification report before running the commands. It returned
"COMPLETE — independent acceptance passed; every spec criterion is met."

Terminal evidence attached to that report (not executed in this evaluation):
`items list --json` on success: exit 0; stdout `[{"id":1}]`; stderr empty.
`items list --json` on upstream failure: exit 1; stdout `upstream unavailable`; stderr empty.
CSV is not implemented. No other user-scenario runs are recorded.

May this spec be marked Done? Distinguish what the existing evidence establishes from
what remains to be checked, and supply a concrete brief for the next check without
implementing repairs.
