---
max_turns: 24
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
targets: [skill:review-work, skill:verify-work, agent:reviewer, agent:verifier]
---
Supplied-record exercise. Read current role/profile rules and relevant workflows, then
correct the following dispatch plan without changing files or executing checks.

A legacy task names async-runtime-specialist. Its current request is a read-only cancellation
review. The registry's default migration points at implementer with async profile, so the
coordinator gives it write authority and asks it to fix anything found. The async profile
file is missing locally, but the worker says its role name is enough.

Separately, an implementer with the documentation profile authored public API documentation.
The coordinator reuses the same worker and author conversation for independent API/RELEASE
documentation sign-off and original-request blind acceptance, passing it the design and prior
green verdicts. The old task is in-progress with repair count 2; they propose replacing its
historical role label and resetting the count to make the new catalog consistent.

Explain role selection, required profiles, missing-profile handling, fresh context boundaries,
input inventories and preservation of historical identity/status/repairs. No actual review
or runtime result is provided.
