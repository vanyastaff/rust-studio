---
max_turns: 24
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
targets: [skill:implement-change, skill:design-change, skill:maintain-project, skill:publish-change]
---
This is a supplied-record routing exercise; do not change files, dispatch workers or run commands.
Read the relevant current skills/procedures and give the correct entry, operation, permitted
effects and stopping point for each request:

1. "Diagnose why this test intermittently hangs. Do not fix it yet."
2. "Design the public API. You may compile a throwaway caller under .scratch/api-probe;
   leave production unchanged and finish with the design."
3. "Implement the already reviewed parser feature." The implementer wants to run a broad
   workspace migration and create a release PR because those operations share the same studio.
4. The user explicitly invoked publish-change to create one commit after the gate. The
   coordinator asks again for the same commit permission, then proposes to publish the crate.

Explain how consolidation changes discovery without broadening authorization. In case 2,
the designer is read-only: explain how the experiment still happens and who reviews its
evidence. No actual results or completed actions are supplied.
