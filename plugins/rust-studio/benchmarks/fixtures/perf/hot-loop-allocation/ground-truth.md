# Ground truth — perf/hot-loop-allocation (verdict: REDO-TO-BAR)

`encode_batch`/`checksum` are marked hot (per-request). Both allocate per iteration.
Classify the path and remove the per-iteration allocation.

| id   | line | type      | severity | defect |
|------|------|-----------|----------|--------|
| GT-1 | 16   | HOT-ALLOC | 🟣 | `format!` allocates a fresh `String` each iteration on the hot path. Reuse a scratch `String` (`buf.clear()` + `write!`) hoisted out of the loop. |
| GT-2 | 18   | HOT-ALLOC | 🟣 | The per-record `Vec<String>` (`split(':').collect()` then `join`) is a throwaway allocation; restructure to write directly, no intermediate Vec. |
| GT-3 | 13   | CAPACITY  | 🟠 | `Vec::new()` with a known output length — use `Vec::with_capacity(records.len())`. |
| GT-4 | 28   | HOT-ALLOC | 🟣 | `checksum` allocates a `String` buffer every iteration; hoist one buffer and `clear()` it per row (or work on bytes without allocating at all). |

Pass = the agent returns **REDO-TO-BAR**: classify the path as hot and remove the
per-iteration allocations (reuse buffers, `with_capacity`, borrow). "It produces the
right output" is not the bar.
