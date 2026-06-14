<!-- Rust Code Studio template — verification report for a spec. Written by /spec-verify into .rust-studio/specs/<slug>/verify-report.md. Evidence over assertion: paste real command output. -->

# Verify Report: <feature name>

- **Spec:** [`spec.md`](spec.md)   ·   **Date:** `YYYY-MM-DD`   ·   **Verdict:** `COMPLETE / NEEDS WORK / BLOCKED`

## Acceptance criteria → result
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | *…* | ✅ pass / ❌ fail | *test name / bench / command* |
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
- [ ] QA-GATE (`qa-lead`)
- [ ] API-GATE / ASYNC-GATE / PERF-GATE / SAFETY-GATE / RELEASE-GATE — *as the spec touched them*
- [ ] `rust-reviewer` diff audit clean

## Follow-ups / left out of scope
- *…*

## On pass
*Spec marked Done. Suggested: `/remember` durable learnings · `/changelog` if user-facing ·
`/commit` + `/pr` to ship.*
