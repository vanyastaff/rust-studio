---
name: refactor
description: "Use when refactoring or simplifying tangled Rust code without behavior changes: tests and the project gate as the oracle."
---

# /refactor — behavior-preserving refactor pass

Run a scoped refactor through **confirm scope → pin behavior → signals → plan → refactor steps →
verify → review**, honoring the collaboration protocol (`references/collaboration.md`). You are
the orchestrator: **you do not write code yourself — you delegate all writes to `rust-builder`.**
Prompt the user only at phase boundaries (scope confirmation, plan approval, BLOCKED recovery) —
decide tactical calls yourself, state choice + one-line rationale.

**Maintainer bar applies.** This skill is where weak structure is brought up to
`references/maintainer-grade-development.md`: behavior-preserving reshaping of
weak structure (extract, move-to-owning-crate, borrow-instead-of-clone, replace stringly/bool
with domain types) IS the job here, not a while-I'm-here cleanup to suppress.

## When NOT this skill
- The code isn't changing — you want to confirm already-finished work matches a written
  spec before archiving it → `/spec-verify`: it runs the spec's acceptance criteria
  against `.rust-studio/specs/<slug>/spec.md` and produces a verify report. `/refactor`
  restructures code under a behavior-preserving constraint; it doesn't check work against
  a spec or archive anything.
- You want the inventory, not the work — a prioritized list of TODOs, suppressed lints,
  panic paths, and oversized units to file as stories → `/tech-debt`. It never edits; this
  skill only ever edits.
- The change is *supposed* to alter behavior — a fix, a feature, a new error path → `/dev-task`.
  Here any observable difference is a defect, there it is the point.
- The model itself is wrong — a closed string set that should be an enum, a state machine
  drawn as `Option` fields — and you want it re-cut with its invariants → `/model-domain`.
  `/refactor` may replace a stringly type on the way past; it does not redesign the domain.
- Moving an edition or a major dependency → `/migrate`: same discipline, but the diff is
  machine-generated and the semantic review is specific to edition lints.

## Progress visibility
Use the host's task or plan surface when available; otherwise keep a concise in-message checklist.
Create one item per phase (scope → pin → signals → plan → refactor → verify → review), mark the
active phase, and surface each result in one line before moving on. Keep blocking phases in the
foreground so the user sees intermediate evidence instead of a final dump.

## Input
`input` is the target scope (a crate, module path, file, or free-text description). If
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

**Recall first:** `/recall <target area>` (or reuse the session-start memory index if it already
surfaced this area) and carry prior boundary decisions and gotchas into the plan — prior boundary
decisions bind refactors; say when a recalled note changes the approach. If nothing surfaces,
proceed (`references/memory-protocol.md`).

1. Restate the scope in one sentence and list 2–3 explicit "must not change" invariants
   (e.g. public API surface, observable behavior, performance characteristics).
2. Prompt the user: confirm the scope and invariants before touching anything. If the user
   wants to widen scope or allow behavior changes, treat the difference as a separate task.
3. Spawn **`rust-scout`** to map the files and symbols in scope — definitions, every caller
   (`findReferences` / `find_referencing_symbols`), and where tests exercise the target. Do not
   guess the layout.
4. Note any `unsafe` blocks in scope — flag them; they require extra care and will trigger
   the `SAFETY-GATE` at review.

---

## Phase 2 — Pin the behavior (the oracle, before any reshape)

A refactor's only proof is a suite that would have gone red had behavior moved. Tangled code
usually arrives with a suite that cannot say that, so establish the oracle first.

5. **Discover the project's gate** — `justfile`, `Makefile`, `xtask`, cargo-make, lefthook, or
   the CI lint/test job — and run it as-is (`references/project-gate.md`). Record the exact
   command, the test count, and the clippy state: this is the baseline every later step is
   compared against. A red baseline blocks — fix the build first (`/fix-build`), or every later
   failure is ambiguous. Only a project with no gate falls back to the studio defaults
   (`cargo nextest run`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt`).
6. **Measure what the suite observes in scope.** Ask the scout which public behaviors of the
   scope have a test that asserts a *value or effect* (not `is_ok()`); `cargo llvm-cov` when
   installed, `rg '#\[test\]'` and a read of the assertions otherwise. Anything you are about to
   reshape that has no such test is **unpinned**.
7. **Write characterization tests for the unpinned behaviors** — spawn `test-engineer`: tests
   that record what the code does *today* (return values, error messages and variants, ordering,
   side effects), including the ugly cases you would not have designed. Use `insta` snapshots for
   large or structured output. These are regression guards, not correctness proofs
   (`references/integrity-and-evidence.md` §"The Evidence Rules"); they exist to make the next
   phases falsifiable. Commit them green before the first reshape when the user wants bisectable
   history.
8. **Calibrate the oracle.** Break one behavior in scope on purpose — swap two branches, flip a
   comparison, drop an early return — run the gate, confirm it goes red, revert. If it stays
   green the suite is blind there: either add the test that sees it or state the blind spot on
   the `BASELINE:` line and treat later greens as evidence about compilation, not behavior. One
   deliberate break is the budget here; `/mutants` is the systematic version.

---

## Phase 3 — Signals

9. **Lint signals.** The gate's clippy run (step 5) is the primary list. For a
   *simplification* scope, add a one-off probe for the readability lints most gates leave off —
   a `-W` on the command line, never an edit to the gate config:

   ```
   cargo clippy --all-targets -- -W clippy::cognitive_complexity -W clippy::too_many_lines \
     -W clippy::too_many_arguments -W clippy::type_complexity -W clippy::needless_pass_by_value \
     -W clippy::large_enum_variant -W clippy::fn_params_excessive_bools
   ```

   Categorize hits by the rule file that owns them: naming / idiom → `references/core.md`;
   API surface → `references/api.md`; async → `references/async.md`; performance →
   `references/perf.md`; unsafe → `references/unsafe.md`; tests → `references/testing.md`.
10. **Reading signals — what no lint fires on.** These are first-class refactor targets, not
    afterthoughts:
    - **intent-hiding names** — `x`, `tmp`, `data`, `res`, `mgr`, unit-ambiguous (`timeout` not
      `timeout_secs`), synonym-colliding (`fetch`/`get`/`load` for one concept), per
      `references/core.md` *Naming*. If the scope is "make this self-documenting", naming IS the
      primary target — list each weak name with the better one.
    - **design drift** — a `bool` parameter that selects behavior, a `String` field whose value set
      has closed, `Option` fields that are only `Some` for some variants, `Option<Option<T>>`
      (`references/types.md` §"Design-drift tells").
    - **accretion** — a function that has become all exceptions and no rule: a run of `if`s
      bolted onto a shape that fit an earlier requirement; duplicated branches that differ by one
      literal; nesting that needs a diagram to follow.
    - **misplacement** — a helper living where it was convenient rather than where its concept
      lives; a module that has outgrown its crate (`references/architecture.md`
      §"Crate-extraction tells" — and the counter-case beside them; the default is to leave it).
11. Prioritize by impact — state your ranking and rationale, then proceed to Phase 4.

---

## Phase 4 — Plan

12. Draft a step-by-step plan: one logical change per step, ordered so each step leaves the
    tree buildable and the gate green. Each step names the files affected, the transformation,
    and the signal it addresses. The **readability moves** that preserve behavior by construction:
    - flatten nesting with early return, `let-else`, and let-chains; one level of indentation per
      decision;
    - extract a named pure function for each branch body that does one thing — the name replaces
      the comment that explained it;
    - replace a `bool` parameter with a two-variant enum the caller must name; replace a magic
      number with a named `const` that says what it bounds;
    - collapse duplicated branches into one function parameterized by the thing that differed;
    - separate the decision from the I/O around it (a pure core the tests can reach, an
      imperative shell that only calls it);
    - delete a branch only when a type or a characterization test proves it unreachable — never
      because it "looks dead";
    - rename via `ast-grep`/`sg` for a structural rename across the tree, not regex on Rust
      source.
13. If a step touches the public API surface, flag `API-GATE` (owner: `api-design-lead`).
    If it touches `unsafe`, flag `SAFETY-GATE` (owner: `systems-perf-lead` +
    `unsafe-auditor`). Present 2–4 options when there is a real design choice.
14. Prompt the user: show the full plan and get explicit approval. If the user wants
    changes, loop back to step 12. Nothing is written until this is approved.

---

## Phase 5 — Refactor (step-by-step)

15. For each approved step, spawn **`rust-builder`** with:
    - the single approved step description and its scope boundary,
    - the instruction to **make no other changes** — not even "while I'm here" cleanups,
    - the instruction to apply the change as targeted edits and run the **project's gate**
      (step 5's exact command) after the step; `cargo fmt` as well,
    - if `unsafe` is in scope: also `cargo +nightly miri test` where feasible.
16. **`rust-builder` reports the diff and gate output for each step.** Show it to the user.
    If the gate goes red — including a characterization test — stop immediately and prompt the
    user; do not proceed to the next step until the current one is green. A characterization
    test that turned red is a behavior change, and the only allowed edits to it are the ones the
    user approves as a deliberate `/dev-task`, never a quiet update to match the new output.
17. After all steps complete, run the gate once more and capture the output as the final
    evidence baseline. The test count must equal the Phase 2 count plus the characterization
    tests you added — a test that vanished is a finding.

---

## Phase 6 — Review (gate)

18. Spawn **`rust-reviewer`** on the complete refactor diff with the explicit instruction
    to check:
    - no behavior change (API, semantics, visible side effects, error text),
    - no scope creep (changes outside the agreed boundary),
    - no new clippy warnings introduced,
    - the characterization tests still assert the pinned values, none weakened.
19. For **full** mode (multi-crate scope, `unsafe` touched, or public API affected), also
    fan out the relevant gate owners in parallel:
    - `api-design-lead` if the public surface was touched (API-GATE).
    - `systems-perf-lead` + `unsafe-auditor` if `unsafe` was touched (SAFETY-GATE).
    - `async-systems-lead` if async code was restructured (ASYNC-GATE).
20. Default to **lean** mode (single crate, no `unsafe`, internal-only changes) — one
    `rust-reviewer` pass. Use **solo** mode for prototype code only.
21. If `rust-reviewer` returns **NEEDS WORK**, hand the findings back to `rust-builder`
    (loop Phase 5, current step only) until clean or the user decides to stop.

---

## Phase 7 — Verdict

22. Summarize:
    ```
    SCOPE:     <what was refactored — steps completed, files changed>
    BASELINE:  <gate command> · <tests before> · <calibration: the break the suite caught | blind to: class>
    PINNED:    <characterization tests added, and the behaviors they record>
    AFTER:     <tests after> · <clippy> · <miri | semver-checks where run>
    GATES:     <passed>
    DEFERRED:  <items left out of scope — stated, never silently dropped>
    ```
23. End with **COMPLETE / NEEDS WORK / BLOCKED**.
24. If the refactor revealed a **durable** convention or structural pattern worth keeping
    (e.g. the boundary that finally made the code compose), run `/remember` to capture it
    (`references/memory-protocol.md`).
25. Suggest next steps as appropriate: `/review` for a deeper audit, `/dev-task` for any
    behavioral improvements that surfaced during the refactor (a characterization test that
    recorded a bug is the usual one), `/perf` if any hot paths were restructured, `/mutants`
    if the calibration found the suite blind.

---

## Error recovery

If any sub-agent returns **BLOCKED** (e.g. an ambiguous ownership boundary, a missing ADR
for a non-trivial structural decision, or an `unsafe` invariant that cannot be verified):
surface it immediately, do not proceed past the blocked step, and prompt the user with
options — (a) skip the blocked step and note the gap, (b) narrow the scope and retry,
(c) stop and run the prerequisite skill (e.g. `/adr`, `/architecture`). Never discard
completed steps.
