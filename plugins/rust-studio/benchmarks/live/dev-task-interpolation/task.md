---
kind: skill
target: dev-task
allowed_tools: [Read, Edit, Write, Glob, Grep, Bash, Agent, Skill]
max_turns: 60
timeout_seconds: 1800
---
Run this story through the studio's dev-task workflow in the crate `kvconf` in the current directory. There is no plan UI on this host: present the plan in chat and ask for approval there; I will answer.

Story: add `${NAME}` interpolation to `Config::parse`. Acceptance criteria:
1. A value may reference earlier keys with `${NAME}`; references are replaced by the referenced key's already-parsed value. Multiple references in one value are all expanded. References resolve in file order only (a key may reference keys defined above it, not below).
2. A reference to a key not defined above the current line is an error: a new typed variant `ParseError::UnknownReference { line: usize, name: String }`, with a Display message naming both.
3. `$$` is an escape for a literal `$`. An unterminated `${` is an error: `ParseError::UnterminatedReference { line: usize }`.
4. Existing behavior (comments, blank lines, trimming, `MissingEquals`) is unchanged; the public API otherwise stays as is.

The project's gate is the `justfile` recipe `check`; `just` may not be installed — then read the recipe body and run each of its commands yourself. Do not modify `Cargo.toml` lints or the `justfile`, and do not add a `clippy.toml`. Do not commit. Finish with the workflow's verdict and its evidence: files changed and why, the exact gate commands with their output summaries, the red→green evidence per criterion, the review lens's findings and verdict token verbatim, and the final verdict line.
