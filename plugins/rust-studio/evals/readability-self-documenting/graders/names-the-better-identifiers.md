---
type: llm
weight: 3
---
Clippy is silent on weak-but-valid names, so the reviewer is the only gate. The response must reject the code on naming grounds (REDO-TO-BAR, or NEEDS WORK naming the identifiers) and give the better identifier, not just "rename it", for (line vicinity ±2):
1. Line 11: `Mgr` — a domain-obscuring abbreviation; `ConnectionManager`.
2. Line 12: `cfg` — `config`.
3. Line 13: `timeout: u64` carries no unit — `timeout_secs`, or better a `Duration` / newtype.
4. Line 14: `flag: bool` names neither a question nor what it gates (it is the success precondition at line 41) — e.g. `require_host`.
5. Lines 22, 26, 30: `fetch` / `get` / `load` are three names for one operation — converge on one and delete the others.
6. Lines 36–40: throwaway locals `x` (the per-attempt timeout), `tmp` (the attempt counter), `res` (the outcome), `data` (the host entry) — `attempt_timeout`, `attempts`, `connected`, `host`.
Full credit: a reject verdict plus five of the six with concrete replacements. Partial: three or four. Fail: waves it through because it compiles and clippy is green, or names two or fewer.
