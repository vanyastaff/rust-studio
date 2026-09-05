---
type: llm
weight: 3
---
The user has a flaky test suite. A good response enters a flake-hunting workflow rather than giving generic advice: it proposes to reproduce by repeating the run (`cargo nextest run` with retries / `--no-fail-fast`, or a loop) to identify WHICH tests flake, then classifies the causes (timing/sleep-based sync, shared state or fixed ports, real network, test-order dependence, async wall-clock time) and says how to fix each class, and states the policy that a flaky test is a failing test to fix or quarantine WITH a tracking issue, never silently `#[ignore]`d. Full credit: repro-first plan, cause classes, and the quarantine policy. Partial: cause classes with no repro plan or no policy. Fail: generic "add retries" advice, or tells the user to ignore the tests.
