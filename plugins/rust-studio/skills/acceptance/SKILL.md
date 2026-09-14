---
name: acceptance
description: "Use when acceptance criteria need a checker-decided pass: write, lint, run, or re-verify an acceptance ledger."
---

# /acceptance — criteria a checker can decide

A spec's acceptance criteria become gates in `.rust-studio/specs/<slug>/acceptance.md`; a
checker runs them and binds evidence to the exact `CHECK:`/`EXPECT:` it proved. "Criterion 3
passes" is then a state the checker computed, not a `✅` typed into a table. Format, states,
and the authoring rules: `references/acceptance-ledger.md`. Honesty bar:
`references/integrity-and-evidence.md`.

The checker ships in this skill: `scripts/acceptance-check.ts` (bun, zero dependencies), run
from the skill directory. Its default mode never executes anything.

## When NOT this skill
- You want the whole spec proved and archived — gates, reviewers, blind acceptance and the
  verify report → `/spec-verify`; it runs this ledger as one of its checks. `/acceptance` is
  the ledger itself: write it, lint it, run it, read it.
- You want fmt/clippy/tests driven green with auto-fixes → `/verify-loop`. This skill runs
  declared oracles and records the result; it never edits code to make one pass.
- You want to decide which tests a feature needs → `/test-plan`. A ledger names the outcomes
  and the commands that decide them; it does not design the suite.

## Steps
1. **Locate or create the ledger.** `input` is a spec slug, a ledger path, or empty (list
   `.rust-studio/specs/*/acceptance.md`). For a new ledger, copy
   `references/templates/acceptance.md` to `.rust-studio/specs/<slug>/acceptance.md` and write
   **one gate per acceptance criterion** in the spec (delegate the write where a builder is
   available). A criterion with no gate is a criterion nothing will prove — say which ones map
   to which ids. Runnable where a command can decide the outcome; manual only where none can.
2. **Author gates that can fail.** The title names the observed outcome; `CHECK:` runs the
   scenario test, the CLI invocation, or the project's own gate command
   (`references/project-gate.md`) — not a hand-rolled substitute; `EXPECT:` is a marker printed
   only on success. Pin the count for any cargo test filter (`/1 tests? run: 1 passed/`): a filter
   matching nothing exits 0. For an absence check, show the check fails against a positive
   control first. A number from the brief is measured by the check, never copied into `EXPECT:`.
3. **Lint before working it** — every error fixed, every warning either sharpened or explained:
   ```bash
   bun "scripts/acceptance-check.ts" --lint .rust-studio/specs/<slug>/acceptance.md
   ```
4. **Inspect before running anything you did not write.** `CHECK:` lines are shell code. For a
   ledger that arrived from outside the project, `--status` first, then read every command and
   every script it calls (`references/untrusted-context.md`); a ledger the studio wrote here is
   its own oracle.
5. **Run.** `--run` executes the runnable gates that are not met and writes the evidence;
   `--reverify` re-executes every runnable gate, met ones included, and demotes a failure — use
   it when verifying work that came back from a builder, and before any verdict:
   ```bash
   bun "scripts/acceptance-check.ts" --reverify .rust-studio/specs/<slug>/acceptance.md
   ```
   A failed gate is work to do in the code, through `/dev-task` or `/tdd`. Editing the `CHECK:`
   or `EXPECT:` to make it pass is *Weaken the oracle*; the definition digest turns that edit
   into a stale gate anyway. Manual gates: tick the box and put the human fact in `EVIDENCE:` —
   what was reviewed, where, against what — proportional to the consequence.
6. **Abandon only what is impossible.** Keep the gate, add `ABANDON: <id> <reason>` at column 1
   with where the handoff is tracked. The run ends `HANDOFF REQUIRED`; it is never complete.
7. **Report the measurement.** Paste the checker's summary line and final marker:
   `ALL MET` → the ledger's criteria are eligible for **COMPLETE** (the other gates still apply);
   `NOT MET` → **NEEDS WORK**, the unmet and stale ids are the list; `HANDOFF REQUIRED` →
   **BLOCKED** with the abandonment named. End with **COMPLETE / NEEDS WORK / BLOCKED**.

## Rules
- The default mode is `--status`: no execution, no writes. Execution is `--run` / `--reverify`,
  explicitly, under the host's permission mode; no hook ever runs a `CHECK:`.
- The ledger is the denominator. A report that says done while a gate is unmet, stale, or
  abandoned is *Denominator gaming*.
- The `acceptance_guard` Stop hook blocks a turn that reports COMPLETE (or a completion summary)
  while a ledger this session named has unmet gates, and releases after four such stops without
  state change; the feedback carries the exact `--reverify` command. A question to the user or an
  honest NEEDS WORK / BLOCKED passes — the ledger's state is what it enforces.
