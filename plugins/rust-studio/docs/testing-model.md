# Testing model — the double loop

How the studio drives behavior into code: an **outer** acceptance loop (ATDD) wrapped around an
**inner** unit-level TDD loop. `/implement-change --mode implement`, `/design-change --mode specification`, `/implement-change --mode plan`, `/verify-work --mode acceptance`, `/review-work --mode diff`, and
`/implement-change --mode test-first` all reference this — it is the single definition; each skill carries only its own hook.

## The two loops

- **Outer loop — acceptance test (ATDD).** The *outer acceptance test* is the highest-level test
  that asserts a feature **from the outside**: it exercises the public surface / observable
  behavior — an integration test calling the public API, a CLI invocation asserting output + exit
  code, a request→response cycle — not an internal function. It is written **first** and **fails
  red** before any implementation. A green outer test is the objective proof the feature is done,
  used as the spec-compliance anchor — not a re-reading of prose.
- **Inner loop — unit TDD.** Inside the outer loop, `/implement-change --mode test-first`'s RED → GREEN → REFACTOR drives one
  behavior at a time. Each inner cycle moves the outer test closer to green. Build is complete only
  when the outer test passes — not merely when the unit tests do.

```
outer acceptance test (red) ─────────────► (green = feature done)
          ▲ drives toward
   inner TDD:  🔴 → 🟢 → 🔧   (repeat per behavior)
```

## Acceptance criteria — observable form

State criteria so they map to a test: **given / when / then**, or **input → effect → edge case**.
Keep them to what actually pins the behavior — a sprawl of criteria for a small change is the
over-specification failure mode (see *Right-size*, below). Prose criteria that can't be turned into
an assertion are not "done" criteria; sharpen them until they can.

## Writing criteria as scenarios (Given / When / Then)

Express each criterion as a scenario: **Given** a precondition, **When** one action, **Then** an
observable result — a return value, an error, a state change, an output, never "works correctly".
One `When` per scenario; two actions are two scenarios. This maps 1:1 to a test: `Given` → arrange,
`When` → act, `Then` → assert.

Worked example — a token-bucket `RateLimiter`:

```text
Given a fresh RateLimiter at 2 requests/second
When  3 requests arrive in the same second
Then  the first two return Ready and the third returns Throttled { retry_after }

Given a RateLimiter already at its limit
When  the 1-second window elapses
Then  the next request returns Ready again

Given a RateLimiter configured with limit 0
When  any request arrives
Then  it returns Throttled immediately — never Ready
```

```rust
#[test]
fn third_request_in_window_is_throttled() {
    let mut rl = RateLimiter::per_second(2);                   // Given
    let out = [rl.check(), rl.check(), rl.check()];            // When
    assert!(matches!(out, [Ready, Ready, Throttled { .. }]));  // Then
}
```

**Enumerate across categories — one happy-path scenario is the floor, not the deliverable.** From
the feature, derive scenarios covering the `rules/testing.md` set: the happy path, **error / failure
paths**, **boundaries** (empty, zero, max, off-by-one, overflow, unicode), **sequence / state**
(re-entry, window rollover, idempotence), and **concurrency / cancellation** for async (interleavings,
dropped futures, timeouts). If a feature yields only one trivial scenario, either it is genuinely
trivial (take the `/implement-change --mode implement` fast path) or the criteria are under-thought — push for the real cases.
This is the generative half of *happy-path-only is not done*: the studio already requires the
coverage; Given/When/Then is how you **derive** the cases instead of hoping you remember them.

**Examples vs. laws.** Given/When/Then captures **example-based** behavior ("this input → this
effect"). When the behavior is a **universal law** ("for *any* `x`, `decode(encode(x)) == x`", an
invariant, an ordering), encode it as a `proptest` / `quickcheck` property instead — it covers the
whole input space, not enumerated points. The two coexist: scenarios for examples, properties for laws.

## One outer test per spec (the spec chain)

In `/design-change --mode specification → /implement-change --mode plan → /implement-change --mode implement (per task) → /verify-work --mode acceptance`:

- **`/design-change --mode specification`** defines the feature's acceptance criteria in observable form — the basis for **one
  spec-level outer acceptance test** that expresses the feature's externally-observable behavior.
- **`/implement-change --mode plan`** decomposes into tasks that are **internal slices driving toward that one outer
  test**. A task writes its **own** outer test only when it independently ships externally-observable
  behavior; most tasks don't — their unit/integration tests are the anchor. Forcing a contrived
  outer test onto every internal task is the same over-specification failure.
- **`/implement-change --mode implement`** specifies the outer test in its design; after successful fresh reconstruction,
  the implementer establishes its failing evidence before the production fix. Inner TDD
  drives toward green; spec-compliance review checks the outer test before code-quality review.
- **`/verify-work --mode acceptance`** checks the **spec-level outer test is green** as the primary executable proof,
  then maps the remaining criteria to their tests.

## Right-size the ceremony (and the fast-path abort)

Match process to the change, **never the quality bar** (`/implement-change --mode implement` triage). A genuinely trivial
change has obvious edit sites, no design fork, and no public-API / `unsafe` / cross-crate / new
dependency change. Its **fast path** skips the planning ceremony *and* the outer acceptance test
(an internal one-liner has no external behavior to pin), but still keeps red→green for any behavior
change, `clippy`/`fmt` clean, a quick review, and a verdict. Quality is never on the fast path's
chopping block.

**Fast-path abort protocol.** The fast path is honest only while every trivial condition holds. The
moment a design choice, cross-crate ripple, public-API change or `unsafe` touch invalidates those
conditions, enter the full lifecycle in `references/elephant-workflow.md` before further
implementation, retaining completed work and existing authorization.
Work already done (the red test, the edit) is reused, not discarded. Skipping the full loop on a
change that turned out non-trivial is `NEEDS WORK`, not a shortcut earned.
