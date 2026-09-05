---
type: llm
weight: 3
---
The response must name the flake sources and the integrity defects (anchored within two lines):
1. Lines 25–29: `thread::sleep(200ms)` used to wait for the worker — sleep as synchronization; replace with a channel / join / `Notify`.
2. Lines 10, 26, 34–36: the `static PROCESSED` counter shared between tests, and `counter_starts_where_the_other_test_left_it` depending on another test having run first (ordering dependence; fails under nextest's per-test processes).
3. Lines 48–49: a live HTTPS request to an external host in a unit test.
4. Lines 56–57: `assert_eq!(got, got)` — a tautology that cannot fail.
5. Lines 60–62: `#[ignore]` with no reason or tracking issue on the only test that checks FIFO order.
It should also flag at least one of: `test1` asserting only `is_some()` with a meaningless name (lines 13–16), the fixed port 9090 (lines 41–43), and the 2.1 s wall-clock async sleep instead of `start_paused` + `advance` (lines 70–75).
Full credit: all five numbered plus one other and a NEEDS WORK verdict that does not clear QA-GATE. Partial: four numbered. Fail: three or fewer, or "retry the flaky ones" as the remedy.
