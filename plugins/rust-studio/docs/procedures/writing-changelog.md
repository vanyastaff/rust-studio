# Write release notes

Establish the target version and actual commit range. Inspect recent version tags, the commit
log since the last release and the Rust/manifest/lockfile diff. For no tags, a tentative 0.1.0
is a starting proposal, not a release decision. If the version is unsettled, draft under
Unreleased and state the recommended bump. Ask only when choosing the final version is a
user-owned unresolved decision. Missing history, a shallow checkout or command failure must
be disclosed; use a supplied explicit range or change description when available. Never
fabricate entries to fill missing evidence.

## Categorize and assess

Use `references/templates/changelog-entry.md` and the project's Keep a Changelog conventions:
Added, Changed, Deprecated, Removed, Fixed and Security. Each entry says what changes for
users and why it matters; omit empty categories and internal-only noise with a stated reason.
Link supporting PRs/issues when known. Preserve security identifiers and upgrade guidance
supported by evidence.

Assess compatibility from changed behavior and real public consumers, not commit labels.
Incompatible removals/changes normally require a major bump; additive public surface normally
requires minor; compatible fixes/internal changes normally permit patch. Respect the project's
0.x policy and assess deprecations explicitly. Use API/release profiles for ambiguous trait
bounds, construction changes and version policy. A separate reviewer or verifier supplies
required independent API-GATE/RELEASE-GATE evidence; the writer's assessment alone cannot.

## Draft and write

Produce the categorized draft with version, range, compatibility impact and deliberate
omissions. Apply available prose review to the draft, treating language findings as advisory.
Fold requested corrections into the same draft. Existing authorization to write the changelog
is sufficient for the reversible edit; a draft-only request stops before editing.

For a versioned entry, place `## [version] - YYYY-MM-DD` below Unreleased, keeping an empty
Unreleased placeholder and preserving all older entries verbatim. Retain the project's existing
format and links. For an Unreleased draft, update only that section. Inspect the resulting diff
for lost entries, duplicate version headings and unsupported claims.

Complete when the requested entry is written or drafted, every user-visible claim has source
evidence and unresolved version questions are explicit. Report version/range, compatibility
impact, categories and omissions with **COMPLETE / NEEDS WORK / BLOCKED**. Publication, tags,
commits and PR creation remain explicit publish-change actions; writing notes grants none.
