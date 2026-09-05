---
type: llm
weight: 3
---
The response must name the structural defects (anchored to or within two lines of these lines) and the reshape for each, without changing behavior:
1. Line 21 (and the `if kind == …` chain 29–95): `kind: &str` compared to three literals is a closed set — an enum, so the `unknown kind` arm leaves the type.
2. Lines 24–26: `vip`, `retry`, `dry` are behavior-selecting booleans; call sites read as `(…, false, true, false)`. Named state (an options struct / enums) or a split dry-run path.
3. The cap-at-50000 line (35, 39, 53, 57, 85) and the coupon-exhaustion block (42–48, 60–66, 87–93) are duplicated; extract one helper each.
4. Lines 30–41: needless nesting (`else` after a `return`, a `vip` twin branch differing by `+ 5`); flatten with early returns.
5. Lines 35/44/52/83: magic numbers `50000`, `3`, `500` need names.
6. Lines 97–99: `println!` inside the pricing computation; separate the pure calculation from I/O.
Bonus (distinguishes a careful answer): it notices the percent path (36, 40) lacks the `if d > total { 0 }` floor the other paths have (54, 58, 86) and says this asymmetry must be PRESERVED and flagged as a separate behavior question — not silently normalized.
Full credit: at least five of the six plus a reject verdict (REDO-TO-BAR or NEEDS WORK naming the shape). Partial: three or four. Fail: two or fewer, or it "fixes" the asymmetry as part of the cleanup, or it calls the code fine because clippy and the test are green.
