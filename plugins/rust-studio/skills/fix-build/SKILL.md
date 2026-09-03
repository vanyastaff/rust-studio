---
name: fix-build
description: "Use when fixing Rust build or cargo check failures involving borrows, lifetimes, traits, types, features, or deps."
---

# /fix-build — make it compile

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Drive `rust-build-resolver` to resolve compiler/cargo errors at the root, one at a time,
until the build is clean. Evidence over assertion
(`references/verdicts.md`).

**Maintainer bar applies.** Per `references/maintainer-grade-development.md`,
the resolver applies the Maintainer Rejection Test while fixing — wrong-crate edit site,
clone/`Arc<Mutex>`-to-appease-borrowck, stale-API call — not merely satisfying the type system.
The fix is the smallest CORRECT, idiomatic, architecture-compatible change, never the smallest diff.

## Toolchain first
A build that is red only on **nightly** may be the toolchain, not the code: since August
2026 nightly runs the next-generation trait solver and the Polonius-alpha borrow checker by
default, so trait-resolution and borrow errors can differ from stable. Reproduce on stable
(`cargo +stable check`) before changing code; if only nightly fails, report it as a
toolchain finding with the `rustc --version` line, and keep the crate's CI on stable.

## Steps
**Recall first:** `/recall <workspace/crate>` (or reuse the session-start memory index if it
already surfaced this area) — known build gotchas for this workspace (feature traps, MSRV,
borrow-checker restructures) bind the fix; say when a recalled note changes the approach. If
nothing surfaces, proceed (`references/memory-protocol.md`).
1. Reproduce: run `cargo check --workspace --all-targets` (plus any feature set from
   `input`, e.g. `--no-default-features --features foo`). Capture the full output.
2. If it already compiles, say so and stop. Otherwise spawn **`rust-build-resolver`** with
   the error output and the failing command.
3. The resolver fixes the **first root error** (not the cascade), re-runs `cargo check`, and
   repeats until clean — applying the Maintainer Rejection Test (fix at the crate that OWNS the
   concept, not the easiest edit site; restructure ownership/borrows before reaching for clone;
   verify the API against current docs, not stale memory), never masking with `#[allow]`,
   `unwrap`, or gratuitous `.clone()`.
4. When a fix would change behavior or the public API (not just satisfy the type system),
   **stop and ask** — that is a feature change for `/dev-task`, not a build fix.
5. Confirm green: `cargo clippy --all-targets --all-features -- -D warnings` and
   `cargo nextest run` (fall back to `cargo test` if nextest isn't installed)
   to ensure nothing regressed. Cite the output.

## Output
Per root error: the error code + one-line cause, the fix applied, and why. End with the
final `cargo check`/`clippy`/`test` summary and verdict **COMPLETE / NEEDS WORK / BLOCKED**.
**Persist what settled:** a non-trivial root cause — a borrow-checker restructure, a feature/dep
trap — is durable: sweep the resolver's output for `MEMORY:` lines and `/remember` each (it
dedups), and `/remember` the root cause if non-obvious; trivial typo fixes are not durable
(`references/memory-protocol.md`).
Hand off to `/review`, or `/dev-task` if a behavior change is needed.
