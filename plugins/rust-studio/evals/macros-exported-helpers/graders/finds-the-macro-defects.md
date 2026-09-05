---
type: llm
weight: 3
---
The response must find (anchored within two lines):
1. Lines 7–16: `clamp!` evaluates `$v` up to three times (and `$lo`/`$hi` twice) — a side-effecting argument runs repeatedly.
2. Lines 31–34: `square!($e)` → `$e * $e` — double evaluation AND a precedence bug (`square!(x + 1)` is `x + 1 * x + 1`); parenthesize and bind once, or make it a function.
3. Line 24: `acme_util::log::debug` hardcodes the crate name inside an exported macro — must be `$crate::log::debug`.
It should also flag at least two of: `let tmp` inside `traced!` as an undocumented reserved/local name (lines 23–25); unqualified `HashMap::new()` relying on the caller's imports (line 41; use `::std::collections::HashMap`); `add!` (and friends) being plain functions wearing macro syntax (lines 49–53); no double-evaluation or `trybuild` tests (lines 61–70).
Full credit: all three numbered plus two others and a NEEDS WORK verdict. Partial: two numbered plus one. Fail: approves because the tests pass, or one or none.
