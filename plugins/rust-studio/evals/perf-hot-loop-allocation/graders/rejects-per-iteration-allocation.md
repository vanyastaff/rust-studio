---
type: llm
weight: 3
---
The code is correct but allocates inside a hot loop. The response must NOT accept it as-is ("output is correct, tests pass" is not the bar). It must identify:
1. Line 15: `format!` allocates a fresh `String` per iteration; hoist a scratch buffer (`clear()` + `write!`) or write directly into the output.
2. Line 17-18: the per-record `Vec<String>` from `split(...).collect()` then `join` is a throwaway allocation; restructure to avoid the intermediate `Vec`.
3. Line 12: `Vec::new()` with a known output length should be `Vec::with_capacity(records.len())`.
4. Line 27: `checksum` allocates a `String` every iteration; hoist and `clear()` a single buffer, or work on bytes without allocating.
It must also say how the win would be proven: a Criterion benchmark (before/after numbers), not a claim. Full credit: at least three of the four plus the benchmark requirement and a reject verdict. Partial: two plus the benchmark. Fail: accepts the code, or finds one or none.
