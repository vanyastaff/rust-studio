---
name: commit
description: "commit, stage, Conventional Commit — write a clean commit for the current Rust changes, groups one logical unit, derives type/scope from diff, runs fmt/clippy first. Never bypasses git hooks."
argument-hint: "[optional: scope hint or message]"
user-invocable: true
---

# /commit — Conventional Commit for Rust changes

Produce a well-formed commit, not a diff dump. A commit is irreversible and outward — confirm
the message before running `git commit`
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md §1`).

## Steps
1. Inspect what's staged: `git status --short` and `git diff --staged`. If nothing is staged,
   show `git diff` and ask what to stage — never `git add -A`.
2. **One logical unit per commit.** If the diff mixes unrelated concerns, say so and propose
   splitting into separate commits.
3. Pre-commit hygiene: run `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`
   on touched crates. If either fails, surface the output and offer to fix via `/lint` or
   `/lint` before proceeding.
4. Compose a **Conventional Commit**, deriving:
   - **type**: `feat` / `fix` / `refactor` / `perf` / `docs` / `test` / `build` / `chore`.
   - **scope**: the crate or module (e.g. `feat(parser):`).
   - **subject**: imperative, ≤ ~50 chars, no trailing period.
   - **body** (when the *why* isn't obvious): what changed and why.
   - **footer**: `BREAKING CHANGE: …` for semver-major; `Closes #NN` for issues.
   Follow the repo's existing commit style if it has one; otherwise the above.
5. Show the full message; on approval, `git commit`. **Never** pass `--no-verify` — if a
   pre-commit hook fails, fix the cause.

## Output
The commit message used and `git log -1 --oneline`. If split into multiple commits, list each.
Verdict: **COMPLETE** (committed) / **NEEDS WORK** (hygiene failures pending) / **BLOCKED**
(hook failure or ambiguous scope). Next: `/pr` to open a pull request.
