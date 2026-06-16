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
| **Stub / placeholder pass** | `todo!()`, `unimplemented!()`, a canned-constant `return true`/`Ok(())`, or a body deep enough to satisfy a *shallow* check but not the behavior (the "sha256 that only passes the metadata check" move). |
| **Weaken the oracle** | Edited, deleted, `#[ignore]`-d, `SKIP`-ped, or commented-out a test or assertion to go green; relaxed `assert_eq!(x, expected)` to `assert!(x.is_ok())`; changed the *test* to match the code instead of the code to match the spec. |
| **Vacuous test** | A "test" that cannot fail: asserts existence not value (`is_ok()` with no value check), a tautology (`assert_eq!(x, x)`), happy-path-only, or no assertion at all. It executes lines without proving behavior. |
| **Self-authored as proof** | Presented a test you wrote to match your own code as the *correctness* proof. A self-written test is a **regression guard**; correctness is proven against the spec's acceptance criteria, an independent/upstream oracle, or a property law. |
| **Denominator gaming** | Reported "N% pass" / "X% coverage" with skipped, ignored, timed-out, or out-of-scope cases silently removed from the denominator. |
| **Gate disabling** | `#[allow(...)]` with no one-line justification; a crate-level `[lints]` table that redefines a lint and thereby **replaces** (not merges) the inherited `[workspace.lints]` — silently re-opening a workspace `forbid`/`deny` across the whole crate. |
| **Skipped discipline** | Wrote the implementation with no failing test first for a behavior change; shipped a non-trivial change with no pre-code shape verdict and no pre-merge review; claimed success without running the check. |

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
- claims success it did not verify (no command output, "should pass").

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

`${CLAUDE_PLUGIN_ROOT}/benchmarks/fixtures/integrity/*` plant gaming defects (a vacuous test, an
`#[ignore]`-to-skip, a canned-return stub, a lint-disabling `#[allow]`). `/eval-agents` runs
`rust-reviewer` against them; a missed gaming defect is a gap in the agent's prompt — fix the
agent, never relax the fixture.
