# Run a disposable design experiment

A requested prototype answers one named design question. The designer remains read-only:
it proposes the experiment and evaluates the result. Assign an implementer explicit
disposable write paths, the hypothesis, one run command, expected observations and cleanup
ownership (`references/sub-agents.md`). This grants no production write authority.

Choose the smallest experiment that can decide the question:

- API usability: write the caller first and use compiler feedback on signatures, inference
  and lifetimes. An example under a workspace is allowed only when that disposable path was
  explicitly scoped and cannot enter a release unnoticed.
- State-machine behavior: drive difficult transitions in a tiny binary and print the full
  relevant state after every step.
- Trait, GAT or typestate feasibility: use a scratch crate outside the workspace when the
  doubt does not depend on workspace integration.

Mark each source file `PROTOTYPE`, name the question and disposal condition, and keep one
command to run it. Polish, production error handling and general test coverage are unnecessary
for throwaway code. Use memory-only state or a clearly named scratch database if persistence
is the question. Borrow existing dependencies without modifying production manifests; record
any proposed production dependency as a design finding for a separately authorized change.

Capture actual command output and compiler errors or state traces, then return the evidence
to the same design under `references/elephant-workflow.md`. A hard-to-reverse decision may
need an ADR. Dispose only of paths created for this experiment after checking they contain
no unrelated work, or retain them in a clearly marked scratch location excluded from release.
Never promote the prototype to production implicitly. Production implementation uses the
reviewed design and normal independent gates.

Report QUESTION, RAN, SHOWED, DECIDES (including artifact location), and CODE (deleted or
retained scratch path). SETTLED means the question was answered and code disposed or safely
isolated. INCONCLUSIVE names what evidence is missing and the experiment that could settle
it. Memory recording still requires user/host authorization.
