---
name: fix-build
description: "Get a failing Rust build green. Runs cargo check, then drives rust-build-resolver to fix the root error (borrow checker, trait bounds, lifetimes, type mismatch, missing feature/dep) and re-checks in a loop until it compiles. Use when cargo build/check fails."
argument-hint: "[optional: package, --features ..., or target]"
user-invocable: true
---

# /fix-build — make it compile

Drive `rust-build-resolver` to resolve compiler/cargo errors at the root, one at a time,
until the build is clean. Evidence over assertion
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

**Maintainer bar applies.** Per `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`,
the resolver applies the Maintainer Rejection Test while fixing — wrong-crate edit site,
clone/`Arc<Mutex>`-to-appease-borrowck, stale-API call — not merely satisfying the type system.
The fix is the smallest CORRECT, idiomatic, architecture-compatible change, never the smallest diff.

## Steps
1. Reproduce: run `cargo check --workspace --all-targets` (plus any feature set from
   `$ARGUMENTS`, e.g. `--no-default-features --features foo`). Capture the full output.
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
Hand off to `/review`, or `/dev-task` if a behavior change is needed.
