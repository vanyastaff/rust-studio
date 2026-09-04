---
name: merge-conflicts
description: "Use when a Rust merge or rebase is stopped on conflicts: resolve each hunk by intent, then prove it builds."
---

# /merge-conflicts — resolve a stopped merge or rebase

Both sides of a conflict were written by someone solving a real problem. Resolving means
recovering **both intents** and keeping them, not picking the side that looks tidier.

Always resolve. `git merge --abort` throws away the understanding you are about to build; it
is the user's call, never the default.

## How to run
1. **See the state.** `git status`, `git log --oneline --left-right HEAD...MERGE_HEAD` (or
   `REBASE_HEAD`), and the conflicted paths. Say which operation is in flight and what it is
   merging — during a rebase "ours" and "theirs" are inverted, and getting that backwards
   silently reverts someone's work.
2. **Recover the intent** behind each side: the commit messages, the PR, the linked issue.
   Where the studio has been here before, `/recall <area>` carries prior decisions in
   (`references/memory-protocol.md`). A hunk you cannot explain is a hunk you cannot resolve.
3. **Resolve each hunk** by the rules below. Where both intents are genuinely incompatible,
   keep the one matching the merge's stated goal and state the trade-off in the summary.
   Introducing behavior neither side wrote is out of scope — that is a follow-up change.
4. **Prove the tree.** `cargo check --all-targets`, then
   `cargo clippy --all-targets --all-features -- -D warnings`, then `cargo nextest run`
   (fall back to `cargo test`), then `cargo fmt`. A merge that compiles is not a merge that
   works — the tests are the evidence.
5. **Stage the resolution and stop.** Leave the commit to the human: `/commit` for a merge,
   `git rebase --continue` for a rebase, once they have read the summary. Then repeat from
   step 1 for the next conflicted commit in a rebase.

## Rust-specific hunks
- **`Cargo.lock`** — never hand-merge it. Take either side, then regenerate: `cargo check`
  rewrites it, and `cargo update -p <crate>` fixes a single stale entry. Hand-resolving lock
  files invents version combinations neither branch ever built.
- **`Cargo.toml` dependencies and features** — union both sides, then reconcile. Two branches
  adding the same crate at different versions need one version that satisfies both; two
  branches adding different features need both features. A feature dropped in a merge fails
  later in a build nobody connects to this merge.
- **`use` blocks** — union both sides, then let `cargo fmt` order them. Unused imports surface
  in step 4 rather than by inspection.
- **`match` arms and enum variants** — keep every variant from both sides. Exhaustiveness
  makes the compiler your reviewer here; a dropped arm is a compile error, not a silent bug,
  so trust it and re-check.
- **Generated files** (`build.rs` output, bindgen, prost, schema) — resolve the *generator's*
  input, then regenerate. Merging generated output is merging a shadow of the real conflict.
- **`mod` declarations** — union both, then confirm every declared module has a file: a merge
  that keeps a `mod` whose file arrived on neither side breaks the build in a confusing place.

## Output
```
MERGING:   <operation, and what into what>.
RESOLVED:  <path — how each conflict was settled, one line each>.
TRADE-OFF: <any place one intent lost, and why — or "none">.
EVIDENCE:  <check / clippy / test results>.
```
End with **RESOLVED** (staged, tree green, awaiting the human's commit) or **BLOCKED** (name
the hunk whose intent you could not recover, and who can settle it).
