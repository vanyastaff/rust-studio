---
name: refactor
description: "Use to simplify Rust code while preserving behavior proved by tests and the project gate."
---

# /refactor — behavior-preserving refactor pass

Run a scoped refactor through **confirm scope → pin behavior → signals → plan → refactor steps →
verify → review** (`references/collaboration.md`). You are the orchestrator: **you do not write
code yourself — you delegate all writes to `rust-builder`.** Prompt the user only at phase
boundaries (scope confirmation, plan approval, BLOCKED recovery); decide tactical calls yourself
with a one-line rationale.

**Maintainer bar applies.** This skill brings weak structure up to
`references/maintainer-grade-development.md`: behavior-preserving reshaping (extract,
move-to-owning-crate, borrow-instead-of-clone, replace stringly/bool with domain types) IS the job,
not a while-I'm-here cleanup to suppress.

## When NOT this skill
- The code isn't changing and finished work needs checking against a written spec → `/spec-verify`
  runs `.rust-studio/specs/<slug>/spec.md`'s acceptance criteria; this skill restructures code and
  never archives.
- You want the inventory, not the work: TODOs, suppressed lints, panic paths and oversized units to
  file as stories → `/tech-debt`. It never edits; this skill only ever edits.
- The change is *supposed* to alter behavior — a fix, a feature, a new error path → `/dev-task`.
  Here any observable difference is a defect, there it is the point.
- The model itself is wrong (a closed string set that should be an enum, a state machine drawn as
  `Option` fields) → `/model-domain` re-cuts it with its invariants. Here a stringly type may be
  replaced on the way past; the domain is not redesigned.
- Moving an edition or a major dependency → `/migrate`: same discipline, but the diff is
  machine-generated and the semantic review is edition-specific.

## Progress visibility
Use the host's task or plan surface when available; otherwise keep an in-message checklist, one
item per phase (scope → pin → signals → plan → refactor → verify → review), marking the active one
and surfacing each result in a line before moving on. Keep blocking phases in the foreground:
intermediate evidence beats a final dump.

## Input
`input` is the target scope (a crate, module path, file, or free-text description); if empty ask
"What should we refactor, and what's the scope boundary?" An unbounded refactor is drift by another
name, so with no explicit scope there is no start.

## Non-negotiable constraint
**No functional change.** All observable behavior (public API, error messages, exit codes, emitted
events, test assertions) stays identical. A proposed change that would alter any of it is out of
scope and splits into a separate `/dev-task`.

That is not "no structural change": the line is observable behavior, not the shape of the code. The
reshaping the bar above describes is the work.

---

## Phase 0 — What can run here?

A `Bash`/`Write`/`Edit` call that is refused, a session whose tool list simply lacks it, or code
pasted with no crate to build, switches this skill to its **reading mode**: say so once, never retry
the command under another spelling or through another tool (`references/sub-agents.md`), and follow
`references/reading-mode.md` for what still has to run in the reply and why the report in the message
is the deliverable.

## Phase 1 — Confirm scope & invariants

**Recall first:** `/recall <target area>` (or reuse the session-start memory index if it already
surfaced this area) and carry prior boundary decisions and gotchas into the plan; prior decisions
bind refactors, so say when a recalled note changes the approach. If nothing surfaces, proceed
(`references/memory-protocol.md`).

1. Restate the scope in one sentence and list 2–3 explicit "must not change" invariants
   (e.g. public API surface, observable behavior, performance characteristics).
2. Prompt the user: confirm the scope and invariants before touching anything. A user who wants a
   wider scope or a behavior change is asking for a separate task.
3. Spawn **`rust-scout`** to map the files and symbols in scope: definitions, every caller
   (`findReferences` / `find_referencing_symbols`), and where tests exercise the target. Do not
   guess the layout.
4. Flag any `unsafe` in scope: it needs extra care and triggers the `SAFETY-GATE` at review.

---

## Phase 2 — Pin the behavior (the oracle, before any reshape)

A refactor's only proof is a suite that would have gone red had behavior moved. Tangled code
usually arrives with a suite that cannot say that, so establish the oracle first.

5. **Discover the project's gate** (`justfile`, `Makefile`, `xtask`, cargo-make, lefthook, or the CI
   lint/test job) and run it as-is (`references/project-gate.md`). Record the exact command, the
   test count and the clippy state: the baseline every later step is compared against. Beside it,
   `scripts/slop-audit.sh -p <crate>` (skip `clippy` if the gate ran pedantic) records the
   before-numbers the verdict reports: warnings beyond the gate, duplicate pairs, orphans, cycles,
   the largest file. A red baseline blocks, so fix the build first (`/fix-build`) or every later
   failure is ambiguous; a project with no gate falls back to the studio defaults
   (`cargo nextest run`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt`).
   Where no command can run at all (no shell, a denied tool), write `BASELINE: unverified — <why>`
   and keep the reading phases **in this order**: steps 6–8 still come first, their characterization
   tests written out and marked `UNRUN`, the step 8 break described rather than executed. A rewrite
   with tests appended afterward is not a refactor under this skill, whatever the host allowed.
6. **Measure what the suite observes in scope.** Ask the scout which public behaviors have a test
   asserting a *value or effect* (not `is_ok()`); `cargo llvm-cov` when installed, `rg '#\[test\]'`
   and a read of the assertions otherwise. Anything you are about to reshape that has no such test
   is **unpinned**.
7. **Write characterization tests for the unpinned behaviors** — spawn `test-engineer`: tests that
   record what the code does *today* (return values, error messages and variants, ordering, side
   effects), including the ugly cases you would not have designed. Use `insta` snapshots for large
   or structured output. These are regression guards, not correctness proofs
   (`references/integrity-and-evidence.md` §"The Evidence Rules"): they exist to make the next
   phases falsifiable. Commit them green before the first reshape when the user wants bisectable
   history. Either way record the **oracle ref** the Phase 6 test-lock diffs against — that commit,
   or for an uncommitted tree the hash `git stash create` prints (a snapshot; nothing is stored or
   moved).
8. **Calibrate the oracle.** Break one behavior in scope on purpose (swap two branches, flip a
   comparison, drop an early return), run the gate, confirm it goes red, revert. If it stays green
   the suite is blind there: add the test that sees it, or state the blind spot on the `BASELINE:`
   line and treat later greens as evidence about compilation, not behavior. One break is the budget
   here; `/mutants` is the systematic version.

---

## Phase 3 — Signals

9. **Lint signals.** The gate's clippy run (step 5) is the primary list. For a *simplification*
   scope, probe the readability lints most gates leave off with a one-off `-W` on the command line,
   never an edit to the gate config:

   ```
   cargo clippy --all-targets -- -W clippy::cognitive_complexity -W clippy::too_many_lines \
     -W clippy::too_many_arguments -W clippy::type_complexity -W clippy::needless_pass_by_value \
     -W clippy::large_enum_variant -W clippy::fn_params_excessive_bools
   ```

   Categorize hits by the rule file that owns them: naming / idiom → `references/core.md`; API
   surface → `references/api.md`; async → `references/async.md`; performance → `references/perf.md`;
   unsafe → `references/unsafe.md`; tests → `references/testing.md`; a model call →
   `references/llm.md` (the answer lands in a closed type, the branch in a `match`).

   **Tree signals.** For a scope spanning files or crates, spawn **`slop-auditor`**: near-duplicate
   functions and types (`similarity-rs`), orphan files and module cycles (`cargo modules`), `pub`
   nothing reaches (`unreachable_pub`). Its ledger names a reshape per line; carry each into the
   plan as a signal with its command as evidence. Without sub-agents, `scripts/slop-audit.sh -p
   <crate>` runs the same layer as one report (`references/tooling.md` §"Slop and drift").
10. **Reading signals — what no lint fires on.** These are first-class refactor targets, not
    afterthoughts:
    - **intent-hiding names** — `tmp`, `res`, unit-ambiguous (`timeout` not `timeout_secs`),
      synonym-colliding (`fetch`/`get`/`load` for one concept), per `references/core.md` *Naming*.
      If the scope is "make this self-documenting", naming IS the primary target: list each weak
      name with the better one.
    - **design drift** — a `bool` parameter that selects behavior, a `String` whose value set has
      closed, `Option` fields that are only `Some` for some variants, `Option<Option<T>>`
      (`references/types.md` §"Design-drift tells").
    - **accretion** — a function that has become all exceptions and no rule: a run of `if`s bolted
      onto a shape that fit an earlier requirement, duplicated branches differing by one literal,
      nesting that needs a diagram to follow.
    - **misplacement** — a helper living where it was convenient rather than where its concept
      lives; a module that has outgrown its crate (`references/architecture.md` §"Crate-extraction
      tells", and the counter-case beside them: the default is to leave it).
    - **residue** — a comment restating the line under it, a `// ... existing code ...` marker, a
      one-line wrapper that adds only a name, a `#[derive]` list copied onto every type, an
      `#[allow(dead_code)]` on an item to delete (`references/core.md` §"Clarity is design, not
      size"). Size itself is not on the list: a long function with one job and a name that states it
      stays; the 15-line one whose body must be read goes.
11. Prioritize by impact, state your ranking and rationale, then proceed to Phase 4.

---

## Phase 4 — Plan

12. Draft a step-by-step plan: one logical change per step, ordered so each step leaves the tree
    buildable and the gate green. Each step names the files affected, the transformation, and the
    signal it addresses. The **readability moves** that preserve behavior by construction:
    - flatten nesting with early return, `let-else` and let-chains: one level of indentation per
      decision;
    - extract a named pure function for each branch body that does one thing, the name replacing the
      comment that explained it;
    - replace a `bool` parameter with a two-variant enum the caller must name; a magic number with a
      named `const` that says what it bounds;
    - collapse duplicated branches into one function parameterized by the thing that differed;
    - separate the decision from the I/O around it: a pure core the tests can reach, an imperative
      shell that only calls it;
    - delete a branch only when a type or a characterization test proves it unreachable, never
      because it "looks dead";
    - rename via `ast-grep`/`sg` across the tree, not regex on Rust source.
13. If a step touches the public API surface, flag `API-GATE` (owner: `api-design-lead`); if it
    touches `unsafe`, flag `SAFETY-GATE` (owner: `systems-perf-lead` + `unsafe-auditor`). Present
    alternatives only when there is a real design choice. A choice that sets a boundary,
    dependency direction, or crate-wide pattern belongs in an ADR draft (`/adr`), not an implicit
    refactor step. State the blast radius at the top of the plan; split or ask when it creates a
    direction-changing scope decision.
14. Proceed with the plan when it stays within the authorized behavior-preserving scope. Ask only
    when a plan changes that scope or leaves a material design choice unresolved.

---

## Phase 5 — Refactor (step-by-step)

15. For each selected step, use **`rust-builder`** when a handoff earns its cost, with that step,
    its scope boundary, and
    the standing rules in `references/builder-brief.md`, which it needs in full: the no-side-change
    rule that keeps the public surface fixed, the twin-branch rule, the gate run after the step,
    and the `unsafe` case.
16. **`rust-builder` reports the diff and gate output for each step.** Show it to the user. If the
    gate goes red, including on a characterization test, stop immediately; do not proceed to the
    next step until the current one is green. A characterization test that turned red is a behavior
    change, and the only allowed edits to it are the ones the user approves as a deliberate
    `/dev-task`, never a quiet update to match the new output.
17. After all steps complete, run the gate once more and capture the output as the final evidence
    baseline. The test count must equal the Phase 2 count plus the characterization tests you
    added; a test that vanished is a finding.

---

## Phase 6 — Review (gate)

18. **Test-lock, mechanically, before any reviewer reads.** Against the Phase 2 oracle ref:
    `git diff --stat <oracle-ref> -- '*/tests/*' '*_test.rs' '*/tests.rs'` prints nothing, and
    `git diff <oracle-ref> -- '*.rs' | rg -n '^-\s*(assert|#\[test\]|#\[ignore|#\[should_panic)'`
    prints nothing. A hit is a test weakened, removed or silenced during the reshape: **BLOCKED**
    until the user rules on it as a `/dev-task` behavior decision. The reviewer does not start on a
    tree that fails this check.

    Then spawn **`rust-reviewer`** on the complete refactor diff, instructed to check: no behavior
    change (API, semantics, visible side effects, error text); no scope creep (changes outside the
    agreed boundary); no new clippy warnings; the characterization tests still assert the pinned
    values, none weakened.
19. For **full** mode (multi-crate scope, `unsafe` touched, or public API affected), also fan out
    the relevant gate owners in parallel:
    - `api-design-lead` if the public surface was touched (API-GATE).
    - `systems-perf-lead` + `unsafe-auditor` if `unsafe` was touched (SAFETY-GATE).
    - `async-systems-lead` if async code was restructured (ASYNC-GATE).
20. Default to **lean** mode (single crate, no `unsafe`, internal-only changes): one
    `rust-reviewer` pass; **solo** mode for prototype code only.
21. If `rust-reviewer` returns **NEEDS WORK**, hand the findings back to `rust-builder` (loop
    Phase 5, current step only) until clean or the user decides to stop.

---

## Phase 7 — Verdict

22. Summarize:
    ```
    SCOPE:     <what was refactored — steps completed, files changed>
    BASELINE:  <gate command> · <tests before> · <calibration: the break the suite caught | blind to: class>
    PINNED:    <characterization tests added, and the behaviors they record>
    AFTER:     <tests after> · <clippy> · <miri | semver-checks where run>
    SLOP:      <slop-audit before → after: warnings beyond gate, duplicate pairs, orphans, cycles, largest file>
    GATES:     <passed>
    ADR:       <decisions the refactor surfaced that need one — drafted via /adr, not taken here>
    DEFERRED:  <items left out of scope — stated, never silently dropped>
    ```
23. End with **COMPLETE / NEEDS WORK / BLOCKED**.
24. If the refactor revealed a **durable** convention or structural pattern worth keeping (e.g. the
    boundary that finally made the code compose), capture it with `/remember`
    (`references/memory-protocol.md`).
25. Suggest next steps: `/review` for a deeper audit, `/dev-task` for behavioral improvements that
    surfaced (a characterization test that recorded a bug is the usual one), `/perf` if hot paths
    were restructured, `/mutants` if the calibration found the suite blind.

---

## Error recovery

If any sub-agent returns **BLOCKED** (an ambiguous ownership boundary, a missing ADR for a
non-trivial structural decision, an `unsafe` invariant that cannot be verified), surface it
immediately and do not proceed past the blocked step. Prompt the user: (a) skip the blocked step
and note the gap, (b) narrow the scope and retry, (c) stop and run the prerequisite skill (e.g.
`/adr`, `/architecture`). Never discard completed steps.
