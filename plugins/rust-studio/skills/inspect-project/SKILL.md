---
name: inspect-project
description: "Inspect a Rust project's structure and conventions, retrieve prior decisions, find the right workflow, or diagnose the Studio installation."
---

# Inspect project

Select `--mode <operation>` or infer the operation from the request. Inspection is read-only by default. Existing
authorization for context documents or repair remains valid; an operation name grants none.

| Requested outcome | Operation | Read before executing |
|---|---|---|
| Identify stack and tooling | classify | `references/procedures/context-map.md` |
| Orient and choose a next workflow | orient | `references/procedures/context-map.md` |
| Assess conventions, API and debt; record authorized context | onboard | `references/procedures/context-map.md` |
| Find an available skill or execution role | catalog | `references/procedures/context-catalog.md` |
| Retrieve decisions and check freshness | recall | `references/procedures/context-recall.md` |
| Check runtime, hooks, tools or usage | diagnose-host | `references/procedures/context-host.md` |

Use the supplied path, otherwise cwd. Ask for a checkout only when the selected operation
needs one and none can be located. Reuse verified context already collected in this session.
Run the selected procedure to its completion criterion and report evidence and limitations.
For host usage, the portable helper is `scripts/usage-report.ts`, run from this skill folder.

Choose roles and profiles through `references/delegation.md`; when workers are unavailable,
use `references/sub-agents.md` and disclose any missing independent check. Continue an
already-authorized larger task through `references/elephant-workflow.md`; inspection alone
ends with its findings and next action.
