---
name: changelog
description: "Generate or update CHANGELOG.md (Keep a Changelog) for a release — from commits, diff, and semver assessment, via docs-engineer."
argument-hint: "[version]"
user-invocable: true
---

# /changelog — generate or update the changelog

Produce a user-facing changelog entry in [Keep a Changelog](https://keepachangelog.com/) format,
honoring the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You
are the orchestrator: **you do not write to CHANGELOG.md yourself — you delegate the edit to
`docs-engineer`.** Gate at Phase 3 (draft approval) and Phase 4 (write confirmation); decide
everything else autonomously.

## Input
`$ARGUMENTS` is the target version (e.g. `0.4.0`). If omitted, inspect the latest git tag and
propose a semver bump based on what you find, then ask: "Which version are we writing this entry
for?" If no tags exist, default to `0.1.0`.

## Phase 1 — Collect changes
1. State the version and the commit range being summarized (e.g. `v0.3.1..HEAD`).
2. Run read-only git commands to gather raw material:
   - `git log <last-tag>..HEAD --oneline` — commit list since last release.
   - `git diff <last-tag>..HEAD -- '*.rs' 'Cargo.toml' 'Cargo.lock'` — diff for context.
   - `git tag --sort=-version:refname | head -5` — recent tag history.
3. Spawn **`rust-scout`** if you need to locate changed public items or understand the scope of
   API changes without reading the full diff yourself.

## Phase 2 — Categorize & assess semver impact
4. Spawn **`docs-engineer`** to analyze the commits and diff and produce a draft categorization
   using the template at `${CLAUDE_PLUGIN_ROOT}/docs/templates/changelog-entry.md`.
   The categories, per Keep a Changelog:
   - **Added** — new features, new public items, new CLI commands.
   - **Changed** — behavior changes to existing features; non-breaking API evolution.
   - **Deprecated** — items marked for future removal.
   - **Removed** — items deleted (breaking).
   - **Fixed** — bug fixes.
   - **Security** — vulnerability patches.
5. `docs-engineer` also notes the **semver impact** of each category:
   - Removed / incompatible Changed → MAJOR bump required.
   - Added (new public surface) → MINOR bump required.
   - Fixed / internal Changed / Deprecated → PATCH bump sufficient.
6. If the diff touches public API items, consult **`api-design-lead`** to confirm the semver
   assessment and flag anything that silently breaks semver (e.g. a changed trait bound).
   Consult **`release-lead`** on the version number if there is any uncertainty about the bump.

## Phase 3 — Draft (gate)
7. Show the user the categorized draft entry — plain prose, user-facing language, **not** a
   commit dump. Each bullet should say what changed and why it matters to users, not how it was
   implemented.
8. `AskUserQuestion`: present the draft and the recommended semver bump. Ask:
   - Are any entries missing, mislabeled, or too implementation-focused?
   - Is the version bump correct?
   - Should any entries be omitted (internal-only, not user-facing)?

   Loop back to Phase 2 if the user requests significant rework.

## Phase 4 — Approve & write (gate)
9. Once the user approves the content and version, `AskUserQuestion` one final time: "Ready to
   write this to CHANGELOG.md?" — do not write without explicit confirmation (irreversible
   file edit).
10. Delegate the file edit to **`docs-engineer`**:
    - Prepend the new `## [version] — YYYY-MM-DD` block directly below `## [Unreleased]` (or
      create that section if absent), following Keep a Changelog structure.
    - Preserve all existing entries verbatim.
    - Leave `## [Unreleased]` as an empty placeholder above the new entry.
11. `docs-engineer` reports the diff of CHANGELOG.md. Show it to the user.

## Phase 5 — Verdict
12. Summarize: version, semver impact, categories written, and any items deliberately omitted.
    End with **COMPLETE / NEEDS WORK / BLOCKED**.
13. Suggest next steps: `/review` for a full gate audit if not already run, `/publish` to tag
    and publish the release, or `RELEASE-GATE` checklist items if the version bump is MAJOR.

## Error recovery
If `git log` or `git diff` fails (e.g. no commits, shallow clone, no tags): surface the error,
do not proceed, and `AskUserQuestion` with options — (a) provide commit range manually,
(b) write from a description the user supplies, (c) stop. Never write a placeholder or
fabricated entry.

If `docs-engineer` returns **BLOCKED** (e.g. the template is missing): surface the blocker,
note that `${CLAUDE_PLUGIN_ROOT}/docs/templates/changelog-entry.md` may need to be created
first, and stop cleanly. Do not discard the draft categorization.
