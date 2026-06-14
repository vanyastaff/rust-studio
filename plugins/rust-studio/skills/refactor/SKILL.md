---
name: refactor
description: "refactor restructure rename clean up — behavior-preserving refactor pass driven by clippy and studio standards; no functional change."
argument-hint: "[target/scope]"
user-invocable: true
---

# /refactor — behavior-preserving refactor pass

Run a scoped refactor through **confirm scope → clippy signals → plan → refactor steps →
verify → review**, honoring the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You are the orchestrator: **you do
not write code yourself — you delegate all writes to `rust-builder`.** Gate with
`AskUserQuestion` only at phase boundaries (scope confirmation, plan approval, BLOCKED
recovery) — decide tactical calls yourself, state choice + one-line rationale.

**Maintainer bar applies.** This skill is where weak structure is brought up to
`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`: behavior-preserving reshaping of
weak structure (extract, move-to-owning-crate, borrow-instead-of-clone, replace stringly/bool
with domain types) IS the job here, not a while-I'm-here cleanup to suppress.

## Input
`$ARGUMENTS` is the target scope (a crate, module path, file, or free-text description). If
empty, ask: "What should we refactor, and what's the scope boundary?" Refuse to proceed
without an explicit scope — an unbounded refactor is drift by another name.

## Non-negotiable constraint
**No functional change.** All observable behavior — public API, error messages, exit codes,
emitted events, and test assertions — must remain identical after the refactor. If a proposed
change would alter behavior, it is out of scope and must be split into a separate `/dev-task`.

"No functional change" is not "no structural change": behavior-preserving reshaping of weak
structure toward the maintainer bar — extract, move a misplaced helper/type to the crate that
owns the concept, replace clone-to-appease-borrowck with borrowing/ownership, swap a
stringly/bool API for domain types/newtypes/enums — IS the work here, not a contradiction to it.
The line is observable behavior, not the shape of the code.

---

## Phase 1 — Confirm scope & invariants

1. Restate the scope in one sentence and list 2–3 explicit "must not change" invariants
   (e.g. public API surface, observable behavior, performance characteristics).
2. `AskUserQuestion`: confirm the scope and invariants before touching anything. If the user
   wants to widen scope or allow behavior changes, treat the difference as a separate task.
3. Spawn **`rust-scout`** to map the files and symbols in scope. Scout uses **serena MCP**
   (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`) for semantic navigation
   and **`rg`** for macro-generated or `cfg`-gated sites serena can't see. Do not guess the
   layout.
4. Note any `unsafe` blocks in scope — flag them; they require extra care and will trigger
   the `SAFETY-GATE` at review.

---

## Phase 2 — Clippy signals

5. Run (read-only — no approval needed per the protocol):

   ```
   cargo clippy --all-targets --all-features -- -D warnings
   ```

   Capture the output. These are the primary refactor targets. Categorize findings by the
   relevant rule file:
   - naming / idiom lint → `${CLAUDE_PLUGIN_ROOT}/rules/core.md`
   - API surface lint → `${CLAUDE_PLUGIN_ROOT}/rules/api.md`
   - async lint → `${CLAUDE_PLUGIN_ROOT}/rules/async.md`
   - performance lint → `${CLAUDE_PLUGIN_ROOT}/rules/perf.md`
   - unsafe lint → `${CLAUDE_PLUGIN_ROOT}/rules/unsafe.md`
   - test lint → `${CLAUDE_PLUGIN_ROOT}/rules/testing.md`

6. Also note structural issues visible to `rust-scout` that clippy does not catch (duplicated
   logic, over-long functions, misplaced modules). Prioritize findings by impact — state your
   ranking and rationale, then proceed to Phase 3.

---

## Phase 3 — Plan

7. Draft a step-by-step refactor plan: one logical change per step, ordered so each step
   leaves the codebase in a buildable, green-test state. Each step names:
   - the files affected,
   - the specific transformation (e.g. "extract `parse_header` into its own function",
     "replace `unwrap()` with `?` and propagate `Error`", "rename `FooBar` to `Baz` via
     `ast-grep`/`sg` for safe structural rename across the tree"),
   - the clippy lint or rule it addresses.

8. If a step touches the public API surface, flag `API-GATE` (owner: `api-design-lead`).
   If it touches `unsafe`, flag `SAFETY-GATE` (owner: `systems-perf-lead` +
   `unsafe-auditor`). Present 2–4 options when there is a real design choice.

9. `AskUserQuestion`: show the full plan and get explicit approval. If the user wants
   changes, loop back to step 7. Nothing is written until this is approved.

---

## Phase 4 — Refactor (step-by-step)

10. For each approved step, spawn **`rust-builder`** with:
    - the single approved step description and its scope boundary,
    - the instruction to **make no other changes** — not even "while I'm here" cleanups,
    - the instruction to run after each step:
      ```
      cargo nextest run          # fall back to cargo test
      cargo clippy --all-targets --all-features -- -D warnings
      cargo fmt --check
      ```
    - if a step involves pervasive renames: use **`ast-grep`/`sg`** for the structural
      rewrite — safer than regex on Rust source,
    - if `unsafe` is in scope: also run `cargo +nightly miri test` where feasible.

11. **`rust-builder` reports the diff and command output for each step.** Show it to the
    user. If tests go red or clippy regresses, stop immediately and `AskUserQuestion` —
    do not proceed to the next step until the current one is green.

12. After all steps complete, run a final:
    ```
    cargo nextest run
    cargo clippy --all-targets --all-features -- -D warnings
    ```
    and capture the output as the final evidence baseline.

---

## Phase 5 — Review (gate)

13. Spawn **`rust-reviewer`** on the complete refactor diff with the explicit instruction
    to check:
    - no behavior change (API, semantics, visible side-effects),
    - no scope creep (changes outside the agreed boundary),
    - no new clippy warnings introduced,
    - tests still cover all acceptance criteria.

14. For **full** mode (multi-crate scope, `unsafe` touched, or public API affected), also
    fan out the relevant gate owners in parallel:
    - `api-design-lead` if the public surface was touched (API-GATE).
    - `systems-perf-lead` + `unsafe-auditor` if `unsafe` was touched (SAFETY-GATE).
    - `async-systems-lead` if async code was restructured (ASYNC-GATE).

15. Default to **lean** mode (single crate, no `unsafe`, internal-only changes) — one
    `rust-reviewer` pass. Use **solo** mode for prototype code only.

16. If `rust-reviewer` returns **NEEDS WORK**, hand the findings back to `rust-builder`
    (loop Phase 4, current step only) until clean or the user decides to stop.

---

## Phase 6 — Verdict

17. Summarize:
    - what was refactored (steps completed, files changed),
    - evidence: paste the final `cargo nextest run` + `cargo clippy` summary,
    - gates passed,
    - any items left out of scope (note them explicitly — do not silently drop them).

18. End with **COMPLETE / NEEDS WORK / BLOCKED**.

19. Suggest next steps as appropriate: `/review` for a deeper audit, `/dev-task` for any
    behavioral improvements that surfaced during the refactor, `/perf` if any hot paths
    were restructured.

---

## Error recovery

If any sub-agent returns **BLOCKED** (e.g. an ambiguous ownership boundary, a missing ADR
for a non-trivial structural decision, or an `unsafe` invariant that cannot be verified):
surface it immediately, do not proceed past the blocked step, and `AskUserQuestion` with
options — (a) skip the blocked step and note the gap, (b) narrow the scope and retry,
(c) stop and run the prerequisite skill (e.g. `/adr`, `/architecture`). Never discard
completed steps.
