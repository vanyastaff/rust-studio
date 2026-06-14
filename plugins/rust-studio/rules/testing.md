---
name: testing
paths: "**/tests/**,**/*_test.rs,**/benches/**"
description: Test quality standards
---

# Testing Standards

Applies to integration tests, test modules, and benches.

## Coverage that means something
- Tests assert on **behavior and outputs**, not implementation details. A refactor that
  preserves behavior should not break tests.
- Cover the acceptance criteria, the error paths, and the edge cases (empty, max,
  boundary, unicode, concurrent). Happy-path-only is not done.
- Property tests (`proptest`/`quickcheck`) for parsers, serializers, and anything with
  an algebraic law (round-trips, idempotence, ordering).

## Structure
- Unit tests in `#[cfg(test)] mod tests` next to the code; integration tests in `tests/`
  exercising the public API only. Doc-tests for public examples.
- One logical assertion focus per test; name tests for the behavior
  (`returns_err_on_empty_input`), not `test1`.
- Shared setup via fixtures/builders, not copy-paste. No ordering dependencies between
  tests — each runs in isolation.

## No flakiness
- No reliance on wall-clock sleeps, real network, or ambient global state. Inject clocks,
  use `tempfile`, mock or gate external I/O behind a feature.
- Async tests: deterministic; use `tokio::test(start_paused = true)` for time. No race
  on shared ports/files — use ephemeral resources.
- A flaky test is a failing test. Quarantine with an issue link, don't `#[ignore]` silently.

## Tooling
- Prefer `cargo nextest` for speed + isolation. Keep tests fast; mark slow ones.
- Assertions: `assert_eq!` with helpful messages, or `pretty_assertions` for diffs.
