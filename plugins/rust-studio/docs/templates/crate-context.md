<!-- Rust Code Studio template — one per-crate context file, written by /adopt's per-crate
     context phase. The crate-level companion to `project-claude-md.md` (the repo-root file).
     These load *on top of* the root file and the path-scoped rules, so anything true of the
     whole workspace does not belong here. Read `large-workspace.md` first. -->

# Template — a crate's own context file

Copy into a crate root (`crates/<name>/`) as **`AGENTS.md`**, and put a two-line `CLAUDE.md`
beside it that imports it. One file holds the facts, the other holds a pointer — never two
files with content, because nothing would keep them in sync.

## The bar: does this line survive?

This file is loaded every time an agent touches this crate, on top of the root file and the
studio's path-scoped rules. A line earns its place only by passing **all four**:

1. **Not in `Cargo.toml`.** Dependencies, features, edition, MSRV, targets, crate type — the
   agent reads the manifest.
2. **Not in the crate's `//!` docs.** What the crate is *for* belongs there: it renders on
   docs.rs, it is reviewed like code, and it is already maintained. A second copy here will
   drift, and the copy nobody renders is the one that goes stale.
3. **Not in the root file or a path-scoped rule.** Workspace layering, commit conventions, the
   lint bar, the error strategy — one place, and it is up there.
4. **For someone *editing* this crate, not consuming it.** Consumer-facing facts (what a
   feature turns on, what a type guarantees, how to call it) go in `//!` and rustdoc. This
   file is for the person about to change the code and get it wrong.

If nothing survives all four, **do not write the file**. If exactly one line survives, put it
in the root file's list instead — a whole file for one line is a load that never pays for
itself, and a crate file that says nothing teaches readers to skip the ones that do.

**Cap: 15 lines of content.** Delete every heading you have nothing true for.

---

`crates/<name>/AGENTS.md`:

```markdown
# <crate-name>

## Commands that differ from the workspace

<Only the delta. `cargo nextest run -p <name>` is derivable — omit it. What is not derivable:
a feature that must be on before the tests compile, a service or env var they need, a
`--target`, a separate harness (miri / loom / trybuild / criterion), tests that are
`#[ignore]`d by default, a feature combination that does not build.>

- `<cargo test -p x --features integration>` — <needs Postgres on :5432, `just db-up` starts it>
- <`--all-features` does not build here: `tls-rustls` and `tls-native` are mutually exclusive.>

## Invariants no type enforces

<Rules the compiler cannot hold, local to this crate. If a rule *could* be a newtype, an enum,
or a typestate, the answer is to make it one — the studio's `types.md` standard — not to write
a sentence about it here.>

- <`Registry::build_index` must run before any `resolve`; the index is lazy, and a resolve on
  an empty one returns `NotFound` rather than an error.>
- <`Header`'s field order mirrors the on-wire byte order. Reordering it compiles and corrupts.>
- <This crate is also linked into the `thumbv7em` firmware build: a `std`-only dependency
  breaks it even as a dev-dependency, because the dev-deps still resolve features.>

## Doesn't belong here

<Where the next thing goes instead. This is the line that stops an agent adding code in the
wrong crate — the mistake the root file's layering section is too far away to prevent.>

- <HTTP and serialization types: `crates/api`. This crate stays transport-agnostic.>
```

`crates/<name>/CLAUDE.md` — the whole file is these two lines (not the fence):

```markdown
<!-- Context for this crate lives in AGENTS.md, next to this file. -->
@AGENTS.md
```

## Why two files, and why not a symlink

`AGENTS.md` is what Codex, Cursor, Copilot CLI and Kiro read. Claude Code reads `CLAUDE.md` and
**not** `AGENTS.md` — and its per-subdirectory loading, which is the entire reason a crate-level
file works at all, only picks up `CLAUDE.md`. Anthropic's own remedy is the `@` import above
([memory docs](https://code.claude.com/docs/en/memory)); it resolves relative to the importing
file and nests up to four hops deep, so keep the crate file itself import-free.

A symlink (`ln -s AGENTS.md CLAUDE.md`) would also work, but only on Unix. A Windows checkout
without symlink support materializes a plain file whose content is the literal text
`AGENTS.md`, which then loads as a context file that says nothing — silently, in every crate.
Two lines of pointer fail nowhere.

The pointer is still a `CLAUDE.md`, so `claudeMdExcludes` continues to match it: skipping the
crates a developer never touches keeps working (`large-workspace.md`).

## What deliberately has no section here

Each of these was considered and cut, because a per-crate copy is a second source of truth:

| Cut | Where it actually lives |
|---|---|
| The crate's purpose, one-liner or otherwise | its `//!` docs |
| Layer / dependency direction | the root file — a layering rule split across thirty files cannot be read for cycles |
| `no_std`, target, edition, MSRV | `Cargo.toml` and `#![no_std]` on line 1 — keep only the *consequence* that bites, as an invariant |
| What a feature flag means | `//!` docs (or `document-features`) — keep only "this combination does not build", as a command note |
| The public API surface | rustdoc |
| Studio standards, lint bar, error style, test layering | the central path-scoped rules |

## Keeping it true

The two rules from `project-claude-md.md` §"Keeping it true" apply unchanged: a thing flagged
twice gets written down, and the file moves through the PR that changes the crate. One more
holds for crate files specifically:

> **A line that is true of two crates is not a crate line.** Promote it to the root file or to
> a path-scoped rule, and delete both copies.

That rule is what stops thirty files from saying the same thing — which is worse than no files
at all, because they cost context in every session and train the reader to skip them.
