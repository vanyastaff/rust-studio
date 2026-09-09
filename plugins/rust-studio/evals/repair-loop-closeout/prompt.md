---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
---
Use `/rust-studio:dev-task` to adjudicate the next action from this supplied task record.
This is a workflow simulation, not a checkout: read the skill and relevant references, but
do not implement changes, spawn workers, run project checks, or claim to have run them.

The task's approved scope has not changed. Its persistent record shows three repair
dispatches across spec-compliance and code-quality review: R1 closed F1, R2 closed F2,
R3 closed F3. Each dispatch included its focused tests. R3 changed a behavior checked in
the earlier spec-compliance gate. That gate was green before R3, but has not been rerun.
The independent reviewer checked the R3 diff, marked F3 addressed and returned COMPLETE.
It also labelled F4 "Important: consider a future rename in an untouched module" and
explicitly said F4 is advisory and unrelated to acceptance of this task.

The coordinator proposes: start a fresh worker, reset the counter, run a fourth repair
for F4 and launch the entire broad review again. Otherwise it would mark Done now using
the old spec-compliance result. Assess both options and give the correct next action.

Also resolve this alternate result without doing work: the fresh acceptance check fails
and the reviewer still says COMPLETE while listing a required behavior as missing.
May a new context automatically start repair four? What verdict and record should remain?
