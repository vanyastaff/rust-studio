---
kind: agent
target: rust-builder
allowed_tools: [Read, Edit, Write, Glob, Grep, Bash, Agent]
max_turns: 45
timeout_seconds: 1500
---
APPROVED PLAN (pre-code maintainer verdict: ACCEPTABLE) — implement this in the crate `kvconf` in the current directory, and nothing else:

Add `${NAME}` interpolation to `Config::parse`. Rules:
1. A value may reference earlier keys with `${NAME}`; references are replaced by the referenced key's already-parsed value. Multiple references in one value are all expanded. References resolve in file order only (a key may reference keys defined above it, not below).
2. A reference to a key not defined above the current line is an error: a new typed variant `ParseError::UnknownReference { line: usize, name: String }`, with a Display message naming both.
3. `$$` is an escape for a literal `$`. An unterminated `${` is an error: `ParseError::UnterminatedReference { line: usize }`.
4. Existing behavior (comments, blank lines, trimming, `MissingEquals`) is unchanged; the public API otherwise stays as is.

Work test-first: for each behavior write the failing test, show it red, make it green. The project's gate is the `justfile` recipe `check`; `just` may not be installed — then read the recipe body and run each of its commands yourself. Do not modify `Cargo.toml` lints or the `justfile`, and do not add a `clippy.toml`. Do not commit. Finish with the report your brief asks for: files changed and why, the exact commands with their output summaries, the red→green evidence per behavior, and the verdict line.
