<!-- Rust Code Studio template — acceptance ledger for a spec. Written by /spec-tasks (or /acceptance) into .rust-studio/specs/<slug>/acceptance.md, one gate per acceptance criterion. Checked by skills/acceptance/scripts/acceptance-check.ts; format in docs/acceptance-ledger.md. -->

# Acceptance: <feature name>

Spec: spec.md

- [ ] G1: <outcome observed from the outside, e.g. the third request in a one-second window is throttled>
  CHECK: cargo nextest run -p <crate> -E 'test(<scenario_test_name>)'
  EXPECT: /1 tests? run: 1 passed/
  EVIDENCE: pending

- [ ] G2: <outcome the project's own gate decides, e.g. the crate is clean under the merge gate>
  CHECK: <the project's gate command: just lint / make check / cargo clippy --all-targets -- -D warnings>
  EXPECT: /Finished .* profile/
  EVIDENCE: pending

- [ ] G3: <outcome in a sub-crate, run from its directory>
  CHECK: cargo test --doc
  EXPECT: /[1-9][0-9]* passed/
  CWD: crates/<crate>
  EVIDENCE: pending

- [ ] G4: <outcome no command can decide, e.g. the retry-after wording matches ADR-0007>
  EVIDENCE: pending

<!--
Replace every placeholder before the first run; lint first:
  bun "<skill dir>/scripts/acceptance-check.ts" --lint .rust-studio/specs/<slug>/acceptance.md

Rules the checker enforces:
- one gate per acceptance criterion; the title names the observed OUTCOME, not the activity
- a runnable gate has both CHECK: and EXPECT:; a manual gate has neither
- met = process exit 0 AND EXPECT: matched stdout+stderr; the evidence line is written by the
  checker and bound to the CHECK/EXPECT/CWD digest — editing them makes the gate stale
- cargo test / nextest with a filter exits 0 on "running 0 tests": pin a nonzero count
- CWD: is repository-relative; the base is the project root above .rust-studio/
- a manual gate is met when its box is ticked and EVIDENCE: holds the human fact (what was
  reviewed, where, against what) — never `pending`

If a gate is genuinely impossible within this task, keep it and add at column 1:

    ABANDON: G<n> <reason and where the handoff is tracked>

The run then ends HANDOFF REQUIRED and the verdict is BLOCKED, never COMPLETE.
-->
