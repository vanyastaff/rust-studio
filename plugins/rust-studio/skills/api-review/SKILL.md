---
name: api-review
description: "Detect semver hazards, accidental-pub leaks, and required version bump in a public API change — runs cargo public-api / cargo semver-checks, classifies every change with api-design-lead, and drafts mitigations."
argument-hint: "[optional baseline ref]"
user-invocable: true
---

# /api-review — audit a public API change for semver hazards

Analyze the public API diff, classify every change by semver impact, flag
accidental breaks and leaked types, and recommend the required version bump
and any mitigations. You are the orchestrator: **you do not write code or
files yourself — delegate all fixes to `rust-builder`** via `/dev-task`.
Honor the collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

## Input

`$ARGUMENTS` is an optional baseline git ref (tag, branch, or commit SHA).
If omitted, default to the most recent published tag (`git describe --tags
--abbrev=0`). State what you're diffing against before proceeding.

If no baseline can be determined, ask: "What ref should I compare against?"

## Phase 1 — Scope

1. Confirm the baseline ref and the crate(s) under review. For a workspace,
   ask which crates are in scope if it's not obvious from `$ARGUMENTS`.
2. State the review scope in one sentence before proceeding.

## Phase 2 — Gather evidence (read-only; no approval needed)

Run the following commands and capture their full output as evidence:

```
# Public API snapshot diff
cargo public-api --diff <baseline>

# Automated semver-break detection
cargo semver-checks check-release --baseline-rev <baseline>
```

If either tool is absent, note it clearly and fall back to a manual
`cargo doc` + `git diff` inspection via **`rust-scout`** (use serena
`get_symbols_overview` to map the public surface per crate). Never substitute
"probably fine" for running the check.

Also collect:
- `cargo doc --no-deps 2>&1` for any newly undocumented public items.
- Items marked `pub` in the diff that are absent from the documented surface
  (potential accidental `pub`). Use **`rg '^pub '`** (the harness Grep tool)
  to enumerate them; cross-reference against rustdoc output.

## Phase 3 — Classify changes

Spawn **`api-design-lead`** with the raw tool output and the diff. It
classifies each changed item:

| Class  | Examples |
|--------|----------|
| `PATCH` | Doc-only, internal-only, non-public re-exports. |
| `MINOR` | New public item (function, type, trait impl, variant on `#[non_exhaustive]` enum). |
| `MAJOR` | Removed/renamed public item; changed signature; sealed-to-open or open-to-sealed; new required trait method; added non-`#[non_exhaustive]` variant. |

For each `MAJOR` item, `api-design-lead` must also note:
- Whether `#[non_exhaustive]` or a sealed-trait pattern would have prevented
  the break.
- Whether a deprecation + grace-period path exists instead of a hard break.

Flag items that appear to be **accidental `pub`** (types/functions not
mentioned in docs, changelog, or the PR description) and **leaked internal
types** (types exposed only as return/parameter positions without being
independently documented).

## Phase 4 — Question → Options → Decision

4. If `api-design-lead` finds only `PATCH`-class changes: report and end with
   **COMPLETE — patch bump**.
5. If there are `MINOR`-class changes but no `MAJOR`: present the summary and
   proceed directly to Phase 5 recommendations — no gate needed for additive-only
   changes.
6. If there are `MAJOR`-class changes: present all breaks together with context.
   For each break, offer 2–4 mitigation options, for example:

   - (a) Accept the break → requires a major version bump.
   - (b) Deprecate in this release, remove in the next major.
   - (c) Add `#[non_exhaustive]` to enum/struct to absorb future variants.
   - (d) Introduce a compatibility shim (only if it adds no ongoing debt).

   Batch all decisions into a single `AskUserQuestion` before drafting changes.

## Phase 5 — Draft recommendations

7. After decisions are collected (or for MINOR-only: immediately), produce a
   structured report:

```
## API Review — <crate> vs <baseline>

### Bump recommendation
<PATCH | MINOR | MAJOR>  (driven by: <highest-class change found>)

### Changes classified

src/lib.rs:42  MAJOR  Removed `Foo::bar()` — callers must migrate to `Foo::baz()`.
src/lib.rs:87  MINOR  Added `Config::with_timeout()`.
src/types.rs:5 PATCH  Doc update on `Status`.

### Accidental pub / leaked types
src/internal.rs:12  `InternalHandle` is pub but undocumented and exposed only
                    via `open()` return type. Consider `#[doc(hidden)]` or
                    wrapping in a newtype.

### Mitigations approved
- Deprecate `Foo::bar()` in this release; schedule removal for v2.0.
- Add `#[non_exhaustive]` to `Event` enum before tagging.
```

Show the draft to the user before any file changes are made.

## Phase 6 — Apply (with approval)

8. Only after explicit user approval: delegate approved mitigations to
   **`rust-builder`** via `/dev-task`. Typical writes include:
   - Adding `#[deprecated]` annotations.
   - Adding `#[non_exhaustive]` to enums/structs.
   - Wrapping leaked types in `#[doc(hidden)]` or a newtype.
   - Bumping the version field in `Cargo.toml`.

   Instruct `rust-builder` to run `cargo semver-checks` again after changes
   and report the output as evidence.

9. Spawn **`rust-reviewer`** on the resulting diff for a final correctness pass.

## Phase 7 — Gates and verdict

10. This skill feeds two gates that must be signed off before release:
    - `API-GATE` (owner: `api-design-lead`) — public items documented; semver
      impact understood; `#[non_exhaustive]`/sealed where needed; no accidental pub.
    - `RELEASE-GATE` (owner: `release-lead`) — version bumped per semver;
      changelog updated; MSRV verified; `cargo publish --dry-run` clean.

    Confirm `API-GATE` is cleared here. Remind the user to run `/publish` (or
    `/changelog`) to satisfy `RELEASE-GATE` before tagging.

11. End with one of:
    - **COMPLETE — <PATCH|MINOR|MAJOR> bump** — all hazards resolved, gates clear.
    - **NEEDS WORK** — list specific numbered blockers with owners.
    - **BLOCKED** — name the missing prerequisite (e.g. an ADR, an unresolved
      design decision) and suggest the next step (e.g. `/adr`, `/architecture`).

## Error recovery

If `cargo public-api` or `cargo semver-checks` is not installed, surface the
install commands and ask the user whether to continue with a manual `rust-scout`
inspection or to stop and install the tools first. Never silently skip the
evidence step.

If `api-design-lead` returns **BLOCKED** on a design decision, surface it
immediately with `AskUserQuestion` — options: (a) decide now, (b) defer and
mark the item as provisional in the report, (c) escalate to `chief-architect`.
