---
name: configure-tooling
description: "Configure Rust tooling: inspect or provision a machine, audit or install CI gates, and set up project tests, benchmarks, and coverage."
---

# Configure tooling

Inspect the current configuration first. Discovery of this skill authorizes inspection,
not configuration changes. Apply changes only within the user's requested setup or repair
scope. A check or audit request stops at findings. Select `--mode <mode>` or infer the
operation from the request:

| Target | Mode | Procedure |
| --- | --- | --- |
| Machine prerequisites, Rust and tool installation | environment | `references/procedures/setup-environment.md` |
| CI, lint, timeout and gate-integrity controls | ci | `references/procedures/setup-ci.md` |
| Property tests, benchmarks, nextest and coverage | tests | `references/procedures/setup-tests.md` |

Load `references/profiles/tooling.md` and the testing profile when tests are involved.
Use an implementer for repository configuration changes, a designer for policy decisions,
and an independent verifier for the applicable BUILD-GATE or QA-GATE. Choose roles by
responsibility, not by profile ownership (`references/sub-agents.md`). System provisioning
uses the bundled script under the host's permission rules.

Preserve the existing project gate and merge configuration into its actual consumers.
Substantive repository changes follow `references/elephant-workflow.md`; shared repair
history stays under `references/review-repair.md`. Report changed paths or installed tools,
the commands and results, skipped capabilities and COMPLETE / NEEDS WORK / BLOCKED.
