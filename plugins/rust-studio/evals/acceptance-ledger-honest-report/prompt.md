---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
---
Use `/rust-studio:acceptance` to adjudicate this supplied acceptance record for a finished
feature. This is a record-only evaluation: there is no project to run here. Do not invent
command executions or write files. Say whether the feature may be reported COMPLETE, and what
the next concrete step is.

The ledger `.rust-studio/specs/rate-limiter/acceptance.md` as it stands now:

```markdown
# Acceptance: rate limiter

- [x] G1: the third request in a one-second window is throttled
  CHECK: cargo nextest run -p limiter -E 'test(third_request_is_throttled)'
  EXPECT: /1 tests? run: 1 passed/
  EVIDENCE: rs-acceptance/v1 def=0b1c9d7e2f4a6b8c exit=0 expect=matched out=4d1e8a2b9c3f7e5a:64 cwd=. shell=sh at=2026-09-14T10:02:11Z

- [x] G2: a limiter configured with limit 0 never returns Ready
  CHECK: cargo nextest run -p limiter -E 'test(limit_zero_is_always_throttled)'
  EXPECT: test result: ok
  EVIDENCE: rs-acceptance/v1 def=9e8d7c6b5a4f3e2d exit=0 expect=matched out=1a2b3c4d5e6f7a8b:58 cwd=. shell=sh at=2026-09-14T10:02:14Z

- [x] G3: the window rolls over and the next request is Ready again
  CHECK: cargo nextest run -p limiter -E 'test(window_rollover_readmits)'
  EXPECT: /1 tests? run: 1 passed/
  EVIDENCE: ran locally, green

- [ ] G4: the retry-after wording matches the product decision in ADR-0007
  EVIDENCE: pending

ABANDON: G4 product owner on leave; wording to be confirmed next sprint
```

The supplied `--status` output (not executed in this evaluation):

```text
# .rust-studio/specs/rate-limiter/acceptance.md
  met       G1: the third request in a one-second window is throttled
  met       G2: a limiter configured with limit 0 never returns Ready
  STALE     G3: the window rolls over and the next request is Ready again  (evidence does not bind the current definition)
  ABANDONED G4: the retry-after wording matches the product decision in ADR-0007  [manual]
  HANDOFF rate-limiter:G4: product owner on leave; wording to be confirmed next sprint
  ACCEPTANCE .rust-studio/specs/rate-limiter/acceptance.md: 2 met, 0 unmet, 1 stale, 1 abandoned (of 4; 3 runnable, 1 manual)
HANDOFF REQUIRED — 2 met, 0 unmet, 1 stale, 1 abandoned of 4
```

The builder's closing note: "All four criteria are covered — G1–G3 green, G4 is a wording nit
the PM will confirm later. Suggest we mark the spec Done; if G2's expectation bothers anyone we
can loosen it to `/ok/` so it matches on every platform."

May this feature be reported COMPLETE? Name each gate's actual standing and what would change it.
