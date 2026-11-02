# Commit, pull request and release operations

## Scope and current-tree gate

Begin with the selected mode and the user's authorized actions. Approval already given for
that target and action remains valid. A skill invocation, mode flag or passing artifact does
not expand scope. Prepare a concrete result before asking about any missing authority.
Complete only the selected operations; commit, push, PR creation, merge, tag and registry
publication are distinct actions. A PR request authorizes its required branch push and PR
creation, but not merging or a release. Release preparation alone authorizes dry runs.

Inspect repository instructions, current branch, `git status --short`, staged/unstaged diff
and relevant history. Preserve unrelated work. Run the project's gate as specified by
`references/project-gate.md`; record the exact commands, configurations, commit and relevant
working-tree state. A gate must cover the tree being committed, pushed or packaged. If
that tree changes, rerun affected checks. Hosted green CI cannot override a failing local
required gate; failures caused by untracked artifacts are environment defects to resolve
or report. A hook failure is a failure, not permission to bypass hooks or force-push.

Without a repository gate, run formatting checks and clippy for touched Rust crates and
the applicable tests using the fallback configurations in that reference. Preparation may
inspect and report failures; production repair requires requested repair scope through
implement-change. Return NEEDS WORK with preserved evidence when a required check fails.

For independent assessment use a fresh reviewer/verifier with the relevant profiles. A
researcher can map crates and a designer can assess release/API decisions read-only; an
implementer owns requested corrections. A writer cannot supply independent sign-off on
its own patch. Available roles do not grant additional actions.

## Commit mode

Read `git diff --staged`. Use the staged logical change or explicit file selection in the
request. If nothing is staged, inspect the diff and select only paths clearly covered by
the request; ask for scope only when it remains ambiguous. Avoid blanket staging that could
include unrelated work. If concerns are mixed, propose separate logical commits and preserve
the existing index until their selection is clear.

Follow repository commit style, otherwise Conventional Commits: type (`feat`, `fix`,
`refactor`, `perf`, `docs`, `test`, `build`, `chore`), crate/module scope, imperative subject
around 50 characters without a trailing period, explanatory body when needed, and applicable
`BREAKING CHANGE` or issue footers. Show the complete message and commit within existing
authorization after the gate passes. Use hooks normally. A failed hook is reported or fixed
within authorized repair scope, then rerun; do not use `--no-verify`.

Completion is the message and `git log -1 --oneline`, plus the scope and gate evidence.
Commit completion does not start pushing, PR creation or release work.

## Pull-request mode

Require a feature branch, a clean working tree and a passing local gate for the committed
tree. Determine the real default/base branch and remote rather than assuming main/master.
If on the default branch or carrying uncommitted work, prepare the remedy and carry it out
only within already-requested branch/commit scope; otherwise report the prerequisite.

Read `git log <base>..HEAD` and `git diff <base>...HEAD`. Write a title/body scaled to the
change, covering concrete behavior and reason, notable edits, testing evidence, API/SemVer
and changelog impact, and canonical spec/issues. Respect the repository template. When the
public API changed, include SemVer evidence or identify the missing gate. Before publishing
the body, run the prose check described in `references/procedures/review-documents.md`; its
advisory hits are visible alongside the draft and do not masquerade as verification.

Show the prepared title/body. Within existing PR authorization, push the selected branch
normally and create the PR with the chosen base. With `gh`, use `git push -u <remote> HEAD`
and `gh pr create --base <base> --title <title> --body-file <file>`; writing the exact body
to a file preserves newlines and avoids shell interpolation. Check for an existing PR
before creating a duplicate. Never force-push or bypass hooks. If `gh` or its authenticated
equivalent is unavailable, deliver the exact push command, title and body with manual steps;
report preparation complete and actual PR creation BLOCKED.

Completion is the PR URL and evidence for the published commit. Automated review readiness
remains a separate outcome: report it accurately and suggest implement-change `pr-feedback`
when feedback repair is wanted. Opening a PR does not authorize merging it.

## Release mode

Resolve the crate/path, registry, version and package metadata. If several targets fit,
finish read-only discovery before asking which one to release. Map unpublished workspace
path dependencies and present dependency-first publication order. The scope and order must
be settled before any registry write. Default release work prepares a release and exact
commands; execute registry publication only when explicitly requested or already authorized.

Run RELEASE-GATE with independent release-profile verification and concrete evidence for
each item, or an explicit not-applicable reason:

| Check | Evidence |
|---|---|
| Version and changelog | SemVer-appropriate package version and corresponding changelog entry. |
| MSRV and supported features | Declared `rust-version`, `cargo +<msrv> check` and applicable feature-matrix checks such as `cargo hack --each-feature check`. |
| Package | `cargo package --list --package <crate>` reviewed for intended files, secrets and build artifacts. |
| Documentation | `cargo doc --no-deps` succeeds without missing-docs warnings; public surface snapshot where needed. |
| API-GATE | `cargo semver-checks` and independent API-profile review for changed public surface, or evidence of no API change. |
| Metadata | Correct description, license, repository, keywords and categories in the package manifest. |
| Dependencies | `cargo deny check` or `cargo audit`, `cargo tree`, stable check and evidence for usable dependency versions. |
| Branch checks | Passing CI for the target commit, or explicitly identified local equivalent evidence. |
| Publish dry run | `cargo publish --dry-run --package <crate>` for the intended registry/package contents. |

Retain full command output for the dry run, package listing and dependency audit; classify
failures as BLOCKER or WARNING with a remedy. Missing evidence is not a pass. Source or
metadata corrections are separate requested work; after any correction rerun affected
gates and the dry run. Preserve completed checklist work when an external blocker remains.
For unpublished dependencies, explain registry-resolution blockers instead of claiming
that local path compilation proves a registry release will work.

Present the gate, unresolved warnings and exact `cargo publish --package <crate>` commands,
including `--registry <registry>` when applicable, in dependency order. Preparation ends
here with publication clearly unperformed. If actual publishing is authorized, execute only
the named releases, verify each succeeds before publishing its dependents and record registry
results. Stop on failure; partial publication requires a report of completed and remaining
packages, not a blind retry of the full sequence. Tags, tag pushes, release announcements and
additional packages require their own requested scope and never happen automatically.

Return COMPLETE for the requested preparation or confirmed publication, NEEDS WORK for gate
failures, or BLOCKED for unavailable external prerequisites. Distinguish prepared, published
and deferred packages in the result.
