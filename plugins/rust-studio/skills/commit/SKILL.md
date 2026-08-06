---
name: commit
description: "Use when committing one logical Rust change: run fmt and clippy, then create a Conventional Commit."
allowed-tools: "Bash(git status*) Bash(git diff*) Bash(git add*) Bash(git log*) Bash(just *) Bash(make *) Bash(bash scripts/check-*)"
disable-model-invocation: true
---

# /commit — Conventional Commit for Rust changes

Produce a well-formed commit, not a diff dump. A commit is irreversible and outward — confirm
the message before running `git commit`
(`references/collaboration.md §1`).

## Steps
1. Inspect what's staged: `git status --short` and `git diff --staged`. If nothing is staged,
   show `git diff` and ask what to stage — never `git add -A`.
2. **One logical unit per commit.** If the diff mixes unrelated concerns, say so and propose
   splitting into separate commits.
3. Pre-commit hygiene: run `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`
   on touched crates, and — when the repo defines its own pre-PR gate (a justfile recipe,
   a Makefile target, `scripts/check-*.sh`) — run that too. A red local gate blocks the
   commit even when hosted CI happens to be green; a failure caused by untracked local
   artifacts is an environment defect to fix or report, not to skip. If anything fails,
   surface the output and offer to fix via `/lint` or `/fix-build` before proceeding.
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
