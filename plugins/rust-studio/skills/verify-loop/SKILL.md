---
name: verify-loop
description: "Use when driving a Rust change green with cargo fmt, clippy, and tests in a bounded auto-fix loop."
allowed-tools: "Bash(cargo fmt*) Bash(cargo clippy*) Bash(cargo check*) Bash(cargo test*) Bash(cargo nextest*)"
---

# /verify-loop — check → fix → re-run (bounded)

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Converge on green by classifying each failure and applying the smallest fix, then
re-running. **Bounded to 3 iterations** — no infinite loops, no masking. Evidence over
assertion (`references/verdicts.md`).

**Maintainer bar applies.** Each fix is held to
`references/maintainer-grade-development.md`: smallest CORRECT, idiomatic,
allocation-aware, borrow-first change — restructure ownership/borrows before reaching for
clone, fix at the owning crate, check the API against current docs. Smallest is textual scope,
not a license for a junior shape.

**Repo gate first.** The cargo trio below is the studio floor, not necessarily the repo's
gate. Discover the repo's own pre-PR gate — `just --list` (justfile), `make help`,
`scripts/check-*.sh`, an xtask — and run it in the same loop. A red LOCAL gate blocks even
when hosted CI is green (CI may not see what the local gate sees); a gate failure caused by
untracked or ignored local artifacts is an environment defect to fix or report — never a
reason to fall back to "CI is green". No repo gate defined → the trio stands alone.

## When NOT this skill
- The trio is already green and you need to confirm the work satisfies a written spec
  before archiving it → `/spec-verify`. `/verify-loop` only drives cargo fmt/clippy/tests
  (plus the repo's own gate) to green; it has no notion of a spec or acceptance criteria.

## The loop (max 3 passes)

1. **Run** (scope from `input` — package, feature set, or test filter):
   - the repo's own pre-PR gate, when one exists (see **Repo gate first**)
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
   - **Clippy lint** → spawn **`rust-builder`** to apply the minimal idiomatic fix —
     allocation-aware and borrow-first (restructure ownership/borrows before reaching for
     clone/collect/box), at the crate that owns the concept, per the maintainer bar. For
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
  blanket `#[allow]` to silence a real lint, or masking with `unwrap`. Fix the cause. These are the
  gaming moves the honesty bar forbids (`references/integrity-and-evidence.md`).
- A green `cargo clippy` right after a plain `cargo check`/build can be a cache artifact —
  clippy may reuse the fresh check artifacts and skip lints. On a touched crate whose last
  compile was a check/build, `cargo clean -p <crate>` before trusting the clippy verdict.
- If a fix would change intended behavior or the public API, stop and ask — that is a
  decision for `/dev-task`, not a build fix.

## Output

Per iteration: what failed → classification → what was fixed (one line each). Final
`fmt`/`clippy`/`nextest` output as evidence. End with verdict **COMPLETE / NEEDS WORK /
BLOCKED**. If the loop surfaced a **durable gotcha** — a non-obvious fix, a contextual
`#[allow]` with its justification, a borrow-restructure pattern — run `/remember` to capture
it. Pairs with `/tdd`; closes the check loop opened by `/spec-verify` or `/dev-task` — once
green, run `/spec-verify` (if a spec is active) or `/commit` next.
