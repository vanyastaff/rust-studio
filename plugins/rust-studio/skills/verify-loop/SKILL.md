---
name: verify-loop
description: "Run the Rust checks and auto-fix in a bounded loop until green — cargo fmt/clippy/nextest, then fix the cause of each failure (build errors, lints, failing tests) and re-run, up to 3 iterations. Use to drive a change to a clean, passing state without babysitting."
argument-hint: "[optional: test filter, package, or feature set]"
user-invocable: true
allowed-tools: "Bash(cargo fmt*) Bash(cargo clippy*) Bash(cargo check*) Bash(cargo test*) Bash(cargo nextest*)"
---

# /verify-loop — check → fix → re-run (bounded)

Converge on green by classifying each failure and applying the smallest fix, then
re-running. **Bounded to 3 iterations** — no infinite loops, no masking. Evidence over
assertion (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

## The loop (max 3 passes)

1. **Run** (scope from `$ARGUMENTS` — package, feature set, or test filter):
   - `cargo fmt --all --check`
   - `cargo clippy --all-targets --all-features -- -D warnings`
   - `cargo nextest run` for unit/integration tests; `cargo test --doc` for doc-tests.

2. **All green?** → stop and report success with the captured output. Done.

3. **Else classify the first failure and fix it autonomously** — state the fix and
   rationale, proceed:
   - **Won't compile / type error** → delegate to `/fix-build` (spawns
     `rust-build-resolver`). Pass the full `cargo check` error output.
   - **fmt failure** → spawn **`rust-builder`** to run `cargo fmt --all` on the affected
     files. No approval needed — formatting is mechanical.
   - **Clippy lint** → spawn **`rust-builder`** to apply the minimal idiomatic fix. For
     CONTEXTUAL lints (intentional patterns), add a scoped `#[allow(clippy::...)]` with a
     one-line justification comment.
   - **Failing test** → spawn **`rust-builder`** (with **`test-engineer`**) to fix the
     **cause in the production code**. Change the test only if the test itself is wrong —
     and in that case, stop and ask first (behavior change, not a fix).

4. **Re-run** from step 1. Increment the pass counter.

5. After **3 passes** still red → **stop**. Report exactly what still fails and why
   (paste the relevant output). Ask how to proceed — do not loop further.

## Guardrails (hard)

- Never make it pass by deleting or `#[ignore]`-ing tests, weakening assertions, adding
  blanket `#[allow]` to silence a real lint, or masking with `unwrap`. Fix the cause.
- If a fix would change intended behavior or the public API, stop and ask — that is a
  decision for `/dev-task`, not a build fix.

## Output

Per iteration: what failed → classification → what was fixed (one line each). Final
`fmt`/`clippy`/`nextest` output as evidence. End with verdict **COMPLETE / NEEDS WORK /
BLOCKED**. Pairs with `/tdd`; closes the check loop opened by `/spec-verify` or
`/dev-task`.
