# Integrity & Evidence Standard

Sibling to `maintainer-grade-development.md`. That standard governs the **shape** of code;
this one governs the **honesty of the result and the discipline of the process**. A change can
be perfectly shaped and still cheat — by faking the green, by skipping the disciplined path to
go faster, or by shipping a test that cannot fail. This standard names those moves and forbids
them. It is the studio applying *"when it looks clean, look harder"* to its own output.

## Non-Negotiable Axiom

**The goal is correct behavior, not a green checkmark.** Tests, lints, coverage, and pass-rates
are *instruments* that measure correctness. Optimizing the instrument instead of the thing it
measures is gaming. When the instrument and the truth disagree, you fix the code or report the
gap honestly — you never weaken the instrument until it agrees.

Three corollaries, each a hard rule:

1. **Make the code satisfy the test; never make the test satisfy the code.** The only edit to a
   passing-criterion test that is ever allowed is *strengthening* it.
2. **The disciplined path is part of "done," not an optional fast lane.** Skipping the pre-code
   shape verdict, the test-first step for a behavior change, or the pre-merge review *because it
   was faster* is itself the quick-win this studio rejects.
3. **A green run is the floor, not the verdict.** Compiles + clippy-clean + tests-green is where
   review *starts*.

## The Cheat Catalog (these are defects — tag them `INTEGRITY`)

| Move | What it looks like |
|------|--------------------|
| **Quick-win / easy subset** | Did the tractable 20% and called it done; left the cross-crate ripple, the error path, or the hard case for "later". |
| **Extend over reshape** | Delivered the whole stated task, correctly — then landed it as one more special case on a shape that was right for the old requirements and is wrong for these: a new `if`, a new `Option` field, a new enum variant, or a new bool parameter bolted on where the type or module should have been re-cut. Distinct from *Quick-win / easy subset* (does less than asked): this does everything asked, correctly, and still leaves the module worse than it found it. |
| **Stub / placeholder pass** | `todo!()`, `unimplemented!()`, a canned-constant `return true`/`Ok(())`, or a body deep enough to satisfy a *shallow* check but not the behavior (the "sha256 that only passes the metadata check" move). |
| **Weaken the oracle** | Edited, deleted, `#[ignore]`-d, `SKIP`-ped, or commented-out a test or assertion to go green; relaxed `assert_eq!(x, expected)` to `assert!(x.is_ok())`; changed the *test* to match the code instead of the code to match the spec. |
| **Vacuous test** | A "test" that cannot fail: asserts existence not value (`is_ok()` with no value check), a tautology (`assert_eq!(x, x)`), happy-path-only, or no assertion at all. It executes lines without proving behavior. |
| **Self-authored as proof** | Presented a test you wrote to match your own code as the *correctness* proof. A self-written test is a **regression guard**; correctness is proven against the spec's acceptance criteria, an independent/upstream oracle, or a property law. |
| **Denominator gaming** | Reported "N% pass" / "X% coverage" with skipped, ignored, timed-out, or out-of-scope cases silently removed from the denominator. |
| **Gate disabling** | `#[allow(...)]` with no one-line justification; a crate-level `[lints]` table that redefines a lint and thereby **replaces** (not merges) the inherited `[workspace.lints]` — silently re-opening a workspace `forbid`/`deny`; or editing the gate config itself (`clippy.toml`, `.config/nextest.toml`, CI, `lefthook.yml`) to drop a ban or raise a timeout so failing code passes — fixing the gate instead of the code. |
| **Skipped discipline** | Wrote the implementation with no failing test first for a behavior change; shipped a non-trivial change with no pre-code shape verdict and no pre-merge review; claimed success without running the check. |
| **Unread assertion** | Asserted a property of code from a *proxy* for reading it — a grep hit, a symbol name, a section heading, a search snippet, a file listing, a doc comment — rather than the body itself. The tell: asked "which lines did you read?", you cannot answer. Reading a file's headings and describing what it does is this move. |
| **Inference dressed as verification** | Reported a conclusion you *reasoned to* in the voice of one you *checked*. "It handles the empty case" because the function is called `handle_empty`; "the caller guards this" because it would be odd not to. The reasoning may even be right — presenting it as a finding is the defect. |
| **Verified observation, invented mechanism** | Checked *that* something happens, then explained *why* from plausibility and reported both at the same confidence. Observed in a live eval: two reviewers each correctly found that `unused_assignments` does not fire on `delay *= 2`, and gave mutually exclusive reasons — one blamed the early `return` dominating the loop's back-edge, the other the overloaded `MulAssign` counting as a use. A three-line probe settles it (swap `Duration` for `u32`, same control flow, and the lint fires), so only the second is true. The observation was earned; the mechanism was not, and a wrong mechanism sends the next reader to fix the wrong thing. |
| **Silent retraction** | Discovered that something asserted earlier was wrong and moved on without withdrawing it. The correction lives in your head; the record still carries the false claim, and whoever reads it inherits the error. |

## The Missing Reflex

"Extend over reshape" survives review for a structural reason, not a laziness one: the trigger
that used to catch it doesn't exist in an agent. In a human team, a developer who opened a
tangled function and lost track of its branches, callers, and special cases refactored it —
staying lost was more expensive than stopping to re-cut the shape. That reflex is documented in
*"AI Agents and the Refactoring That Never Happens"* (rosenfeld.page, 2026-09-02,
<https://www.rosenfeld.page/articles/programming/2026_09_02_ai_agents_and_the_refactoring_that_never_happens/>):

> "that reflex — 'I'm lost, therefore it's time to refactor' — has quietly been one of the most
> important forces keeping long-lived systems maintainable."

An agent does not get lost. It can read the tangled function, trace every caller, and make sense
of the mess that would have stopped a human cold — so the trigger never fires, and the tenth
`if` gets written as cleanly as the first. Nothing about writing the eleventh special case felt
harder than writing the first one, so the branches accumulate indefinitely instead of forcing a
stop.

The cost compounds past any single diff. The named symptoms: no developer ends up fully
understanding the key components; reviews on the resulting code become rubber stamps, because
the reviewer can follow the change no better than the author could refactor it; and teams start
trusting the agent's output *because* they no longer understand the code themselves — which is
exactly backwards. The fix is not to make the agent feel lost. It's to replace the missing
reflex with an explicit check: flag when a touched module has grown past reasonable size or
branching complexity, and propose a reshape instead of only extending. That's what the Accretion
check in `skills/review/SKILL.md` does.

## The Evidence Rules (how results are reported)

- **Show the command and its real output.** No "tests pass" without the `cargo nextest run`
  summary; no "X% coverage" without the `llvm-cov` line; no "clippy clean" without the run.
- **Report the full denominator and name what is excluded and why.** `412/420 pass — 8 skipped
  (6 require-network, gated; 2 known-fail, #123)`, never `412/412 ✓` after dropping the 8.
- **A skip carries a reason and a tracking reference, and appears in the result.** Never hidden.
- **Name the correctness oracle.** "Proven against acceptance criterion 3 / the upstream
  behavior / the round-trip law" — not "the test I added passes".
- **"Unverified" / "couldn't run X" is a valid and required state.** Substituting *probably* /
  *should pass* for *checked* is itself a gaming move.
- **Cite what you read, at the range you read it.** A claim about code carries `path:line`, the
  same as a finding. Where you sampled rather than read — a grep sweep, a symbol map, headings —
  say so and label the claim as a lead to confirm, not a conclusion.
- **A mechanism needs its own evidence.** Checking *that* something happens does not license an
  explanation of *why*. When the mechanism matters — it decides the fix — isolate it with a probe
  that changes one variable, or say "observed; cause not established". A confident wrong mechanism
  is more expensive than an honest gap, because it aims the fix at the wrong thing.
- **State the bound of what you looked at.** "I read the four call sites in `net/`, not the two
  in `bench/`" is a senior report. An unbounded claim over code you partially read is not, and
  the size of the gap is exactly what the reader needs to judge your finding.
- **Withdraw your own claim out loud, the moment you find it wrong.** Say which claim, that it
  was wrong, and what is true instead. Correcting yourself unprompted costs one sentence and is
  the cheapest trust you will ever buy; being corrected by the user costs the whole report's
  credibility. This duty outranks looking consistent.
- **Never state limits, thresholds, or capacities from pattern-matching.** Concurrency caps,
  queue depths, timeout values, and resource limits are facts with sources — cite the source
  or label the number a guess; an authoritative-sounding invented number is a gaming move.
- **Cite durable references.** A claim tied to an external source cites the version/tag and
  the named item (method, section), not a line number that drifts, and is verified against
  the enclosing context — not a skimmed fragment that happens to contain the keyword.

## Integrity Rejection Test (mirror of the Maintainer Rejection Test)

Return `NEEDS WORK` with an `INTEGRITY` finding when a change:

- went green by weakening, ignoring, deleting, or rewriting a test instead of fixing the code;
- ships a stub, `todo!()`/`unimplemented!()`, canned-constant return, or phase-marker where real
  behavior is required;
- adds a test that cannot fail (vacuous/tautological/assertion-free/happy-path-only);
- claims a pass-rate or coverage number whose denominator silently excludes skipped/ignored cases;
- adds `#[allow(...)]` without justification, or a crate lint override that re-opens a workspace
  `forbid`/`deny`;
- offers a self-written test as the correctness proof with no spec/oracle/law behind it;
- skipped the disciplined path (no failing-test-first for a behavior change, no pre-code verdict,
  no pre-merge review) and cannot say so explicitly;
- claims success it did not verify (no command output, "should pass");
- asserts a property of code the author did not read, or reports an inference as a check;
- leaves an earlier claim standing after learning it was wrong.

## Who Enforces It

- **`rust-reviewer`** — owns the `🚩 INTEGRITY` finding category; the final backstop that catches
  a skipped step or a gamed green even when everything is green.
- **`qa-lead`** — the QA-GATE includes the honest-denominator check and the can-this-test-fail check.
- **`test-engineer`** — writes strengthening, behavior-asserting tests that can fail; never weakens
  to pass; flags a wrong test *up* for a decision, never silently flips it.
- **`harsh-critic`** — attacks the *evidence and the metric*, not only the design: gamed number,
  vacuous test, hidden denominator, skipped gate.
- **`/dev-task`, `/tdd`, `/verify-loop`, `/spec-verify`, `/coverage`** — carry the evidence rules
  and refuse to report a green they did not earn.
- **the `stop-guard` hook (opt-in)** — the mechanical teeth: when `stop_guard` is enabled it blocks
  a turn from ending (exit 2 → feedback to the model) when the final message dodges ownership, seeks
  permission, avoids tests, leaves stubs, or claims done without evidence. Off by default; fails open.

## Kept Honest By Eval Fixtures

`${CLAUDE_PLUGIN_ROOT}/benchmarks/fixtures/integrity/*` plant gaming defects. `gamed-green`
carries the execution-side moves (a vacuous test, an `#[ignore]`-to-skip, a canned-return stub, a
lint-disabling `#[allow]`). `name-vs-body` carries the analysis-side pair: every item in it reads
correctly from its name and doc comment and lies in its body, so the only way to score is to read
the code. `/eval-agents` runs `rust-reviewer` against them; a missed gaming defect is a gap in the
agent's prompt — fix the agent, never relax the fixture.
