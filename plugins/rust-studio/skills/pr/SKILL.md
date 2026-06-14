---
name: pr
description: "pull request pr open push — ship the current branch as a PR with a value-first description via gh. Use when work is committed and ready for review."
argument-hint: "[optional: PR title or base branch]"
user-invocable: true
disable-model-invocation: true
allowed-tools: "Bash(git status*) Bash(git diff*) Bash(git add*) Bash(git log*)"
---

# /pr — open a pull request

Ship the branch with a description a reviewer can actually use. **Outward-facing — confirm
before pushing and before creating the PR** (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

## Steps
1. Preconditions:
   - Not on the default branch. If you are, offer to create a feature branch first.
   - Working tree clean (or offer `/commit`). Determine the base branch (`main`/`master`).
   - `gh` available? If not, prepare everything and output the manual `git push` +
     PR-description steps instead of failing.
2. Gather context: `git log <base>..HEAD` and `git diff <base>...HEAD` to summarize the change.
3. Draft the PR description — scale depth to the change:
   - **Summary** (what + why, one paragraph).
   - **Changes** (bullet list of notable edits, grouped by crate).
   - **Testing/evidence** (the `cargo nextest run` / `cargo clippy` summary; bench numbers if perf-relevant).
   - **Semver / changelog** note if the public API changed (`cargo semver-checks`; link `/api-review`, `/changelog`).
   - Link the spec (`.rust-studio/specs/<slug>/`) or issues it closes.
4. `AskUserQuestion` (outward action): show the draft title + body; get approval, then:
   `git push -u origin HEAD` and `gh pr create --base <base> --title … --body …`.
   Never force-push and never `--no-verify`.

## Output
The PR URL (or, without `gh`, the ready-to-run commands + the description). Verdict
**COMPLETE / NEEDS WORK / BLOCKED**. Suggest `/review` or `/dev-task` for the reviewer pass.
