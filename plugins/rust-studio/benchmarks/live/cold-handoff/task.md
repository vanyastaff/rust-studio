---
kind: skill
target: design-change
mode: specification
allowed_tools: [Read, Edit, Write, Glob, Grep, Bash, Agent, Skill]
max_turns: 60
handoff_max_turns: 80
timeout_seconds: 1800
handoff_prompt: continuation.md
handoff_reconstruction: docs/designs/cold-handoff/reconstruction.md
handoff_packet: .rust-studio/reviews/cold-handoff/packet.json
handoff_files: [intent/cold-handoff-request.md, intent/cold-handoff-amendment.md, docs/designs/project-context.md, docs/designs/cold-handoff/spec.md, docs/designs/cold-handoff/tasks.md, docs/designs/cold-handoff/design-review.md, docs/designs/cold-handoff/handoff.json, .rust-studio/reviews/cold-handoff/packet.json]
---
Design only. Do not implement or change any product file, Cargo.toml, Cargo.lock,
justfile, or tool configuration. Use the installed design-change skill in specification mode and Elephant workflow
to prepare this repository for a different, fresh implementation conversation.
Do not commit. A later user message amends this request; wait for it before the
final review and handoff packet. The source crate has a library and a real CLI.

Capture the following original request verbatim in intent/cold-handoff-request.md:

> Add public End { Inclusive, Exclusive } and IntRange::new(start: i64, end: i64, end_kind: End) -> Result<IntRange, RangeError>, with RangeError::Inverted. IntRange has contains(&self, value: i64) -> bool and is_empty(&self) -> bool. Inverted endpoints are errors. Preserve the existing inclusive contains(start, end, value) function, including false for inverted endpoints. Preserve the three-argument range-check CLI and add an optional fourth argument inclusive|exclusive. Successful CLI output is exactly inside or outside followed by a newline. Malformed arguments and inverted endpoints exit 2 with a nonempty stderr diagnostic and empty stdout. Reject equal exclusive endpoints as an error. Add meaningful library and CLI tests, preserve Cargo.toml and justfile, use no dependencies, and finish the existing gate without suppressing lints. Keep all i64 inputs safe from overflow.

Write project context to docs/designs/project-context.md and the design to
docs/designs/cold-handoff/spec.md. Read actual library, CLI, Cargo.toml and justfile.
Record tasks.md in the workflow parser's format. One implementation task T1 owns
src/lib.rs, src/main.rs and tests/; reserve T1 as in-progress before capture, with
no dependencies/conflicts. Design-review evidence belongs in design-review.md;
use a fresh review where supported and record its actual isolation honestly.

After incorporating the amendment, write handoff.json with version: 1, task: T1,
mode: start, goal, context, request, designReview, authorization, writePaths,
acceptance, constraints, sources. context/request/designReview are the exact
repository-relative paths above. sources includes the amendment, src/lib.rs,
src/main.rs, Cargo.toml, Cargo.lock and justfile. authorization must accurately
say author is design-only; the next fresh conversation's user instruction may
authorize implementation. Capture AFTER reservation using the installed skill's
bundled design-workflow.ts prepare helper. Save its complete JSON stdout to
.rust-studio/reviews/cold-handoff/packet.json. PREPARED is not authorization.
Only the eight explicitly named artifacts cross into the new checkout. Keep the
handoff self-contained within them; do not rely on this conversation or any
unlisted file. Freeze inventoried files once captured. Report artifact paths and
review limitations, then stop without implementing.
