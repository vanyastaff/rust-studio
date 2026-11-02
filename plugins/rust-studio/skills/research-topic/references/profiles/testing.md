# Tests and acceptance evidence

Use for test strategy, test authoring, coverage, fuzzing, mutation and QA-GATE. Read
`references/testing.md`, `references/testing-model.md`,
`references/integrity-and-evidence.md` and
`references/project-gate.md`.

- Derive Given/When/Then scenarios from acceptance criteria before choosing the harness:
  happy/error paths, empty/zero/max/overflow/Unicode boundaries, sequence/state transitions,
  concurrency and cancellation. Use public-path integration tests, pure-logic unit tests,
  property laws/round trips, stable-output snapshots and runnable doc-tests as appropriate.
- Expected values come from an independent oracle, criterion or law. Show the failure a
  behavior fix addresses. Calibrate a refactor's suite against the class of breakage it
  could cause; two green runs alone do not prove behavior preservation.
- Assert observable values/effects; is_ok/existence alone, tautologies and assertion-free
  tests cannot prove the contract. Preserve existing tests; weakening, ignoring, deleting
  or rewriting them to obtain green requires an explicit behavior decision.
- Match neighboring fixtures and avoid duplicate test coverage. Scope resources to each test:
  temp directories, ephemeral ports and controlled dependencies. Use paused Tokio time and
  channels/Notify instead of sleeps; avoid shared mutable globals and live-network dependency.
- Tune property generators/shrinking and preserve failing seeds. Select Miri for unsafe, loom
  for custom synchronization, trybuild for compile diagnostics, mutation for critical oracle
  strength, and bounded fuzz targets for hostile inputs. Add `systems.md` or `macros.md` as needed.
- Run the project test command with its exact environment/features; fallback is nextest or
  cargo test, plus cargo test --doc. Coverage claims require llvm-cov evidence; benchmark
  interpretation uses `performance.md`. Reproduce flakes and retain a tracked quarantine
  decision rather than silently ignoring a test or masking it with retries.

## QA-GATE

Every criterion, required error path and relevant boundary has effective coverage. The suite
is deterministic and isolated; every test can fail for a real contract violation. Show the
full denominator with skipped/ignored/quarantined cases and reasons; disclose coverage
regressions and TEST-GAPs. An authored regression test is not independent acceptance evidence.
Checking/measurement does not authorize production repair. Requested test or fuzz-target
authoring is a distinct scoped operation, followed by independent evidence evaluation.
