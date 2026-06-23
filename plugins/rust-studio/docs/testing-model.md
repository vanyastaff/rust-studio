# Testing model — the double loop

How the studio drives behavior into code: an **outer** acceptance loop (ATDD) wrapped around an
**inner** unit-level TDD loop. `/dev-task`, `/spec`, `/spec-tasks`, `/spec-verify`, `/review`, and
`/tdd` all reference this — it is the single definition; each skill carries only its own hook.

## The two loops

- **Outer loop — acceptance test (ATDD).** The *outer acceptance test* is the highest-level test
  that asserts a feature **from the outside**: it exercises the public surface / observable
  behavior — an integration test calling the public API, a CLI invocation asserting output + exit
  code, a request→response cycle — not an internal function. It is written **first** and **fails
  red** before any implementation. A green outer test is the objective proof the feature is done,
  used as the spec-compliance anchor — not a re-reading of prose.
- **Inner loop — unit TDD.** Inside the outer loop, `/tdd`'s RED → GREEN → REFACTOR drives one
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

## One outer test per spec (the spec chain)

In `/spec → /spec-tasks → /dev-task (per task) → /spec-verify`:

- **`/spec`** defines the feature's acceptance criteria in observable form — the basis for **one
  spec-level outer acceptance test** that expresses the feature's externally-observable behavior.
- **`/spec-tasks`** decomposes into tasks that are **internal slices driving toward that one outer
  test**. A task writes its **own** outer test only when it independently ships externally-observable
  behavior; most tasks don't — their unit/integration tests are the anchor. Forcing a contrived
  outer test onto every internal task is the same over-specification failure.
- **`/dev-task`** Phase 1 writes the outer test for a standalone change, or receives the spec-level
  one as context inside the chain; its inner TDD (Phase 4) drives toward green; Phase 5a checks the
  green outer test as the spec-compliance anchor.
- **`/spec-verify`** checks the **spec-level outer test is green** as the primary executable proof,
  then maps the remaining criteria to their tests.

## Right-size the ceremony (and the fast-path abort)

Match process to the change, **never the quality bar** (`/dev-task` Phase 0). A genuinely trivial
change — single obvious edit site, no design fork, no public-API / `unsafe` / cross-crate / new
dependency — takes the **fast path**: it skips the planning ceremony *and* the outer acceptance test
(an internal one-liner has no external behavior to pin), but still keeps red→green for any behavior
change, `clippy`/`fmt` clean, a quick review, and a verdict. Quality is never on the fast path's
chopping block.

**Fast-path abort protocol.** The fast path is honest only while every trivial condition holds. The
moment one fails — the "one-liner" reveals a design choice, a cross-crate ripple, or a public-API /
`unsafe` touch — **stop and enter the full loop** (`EnterPlanMode` → Phases 1–3 → resume the build).
Work already done (the red test, the edit) is reused, not discarded. Skipping the full loop on a
change that turned out non-trivial is `NEEDS WORK`, not a shortcut earned.
