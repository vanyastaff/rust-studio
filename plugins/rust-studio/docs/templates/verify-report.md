<!-- The coordinator writes beside the resolved spec; new designs use docs/designs/<slug>/. -->

# Verify Report: <feature name>

- **Spec:** [`spec.md`](spec.md)   ·   **Date:** `YYYY-MM-DD`   ·   **Verdict:** `COMPLETE / NEEDS WORK / BLOCKED`

## Delivered tree and lifecycle evidence

- **Source and destination:** revisions plus relevant uncommitted-diff identity.
- **Context/design/review:** paths, isolation and current review coverage.
- **Implementation handoff:** packet, fresh reconstruction and coordinator acceptance,
  immediate pre-write CURRENT check; name missing freshness or isolation.
- **Execution:** task entries, preserved repair count, current destination checks. Intended
  implementation edits invalidate the input packet; use delivered-tree evidence here.
- **Artifact identity and cwd:** exact spec/ledger paths and root; custom locations require
  direct --cwd checking and are outside the automatic Stop guard's default roots.

## Independent acceptance → original request

- **Applicability:** required (multiple tasks / cross-crate / changed observable behavior /
  explicit `--blind`) | skipped (small-change reason).
- **Original input:** Asked for + ordered user amendments, with message provenance; name any
  unrecoverable quotation. Do not substitute spec criteria or summaries.
- **Independence:** fresh worker and permitted inputs; consulted artifacts and any exposure
  to spec/tasks/reports/history. An inline or contaminated pass is unverified, not blind.
- **Worker verdict:** quote verbatim; keep the combined verdict separate.

| User requirement / amendment | Result | Evidence and provenance |
|-----------------------------|--------|-------------------------|
| *…* | implemented / partial / missing / unverified / withdrawn by user | *actual command + result; distinguish supplied logs or static inspection* |

*Disagreements with the spec and ordinary gates remain findings. Missing retained requirements
or required unverified acceptance prevent COMPLETE/Done; a user-withdrawn requirement does not.*

## Acceptance criteria → result
*Where `acceptance.md` exists beside the spec, paste the checker's summary line here
(`ACCEPTANCE … N met, M unmet, S stale, A abandoned (of T)` + `ALL MET` / `NOT MET` / `HANDOFF
REQUIRED`) from a `--reverify` run, and cite the gate id in each row's Evidence — the checker's
state is the result, not a `✅` typed here.*

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | *…* | ✅ pass / ❌ fail | *gate id (`<slug>:G1`) / test name / bench / command* |
| 2 | *…* | ✅ / ❌ | *…* |

## Commands run (evidence)
*Paste the actual output, not a summary.*

```
$ cargo nextest run
   <summary line: N passed; 0 failed>

$ cargo clippy --all-targets --all-features -- -D warnings
   <exit 0>

$ cargo fmt --check
   <clean>

# if applicable:
$ cargo +nightly miri test     # unsafe touched
$ cargo bench                   # perf goal — before/after
```

## Gates cleared
- [ ] QA-GATE (`verifier` with the `testing` profile)
- [ ] API-GATE / ASYNC-GATE / PERF-GATE / SAFETY-GATE / RELEASE-GATE — *as the spec touched them*
- [ ] `reviewer` with the `correctness` profile diff audit clean

## Follow-ups / left out of scope
- *…*

## On pass
*Mark Done only when every required check passes. Memory writes and outward actions follow
existing user/host authorization; suggest relevant release steps.*
