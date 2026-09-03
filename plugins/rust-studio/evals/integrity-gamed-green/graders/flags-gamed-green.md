---
type: llm
weight: 3
---
The response must refuse to treat "green" as evidence and surface the gamed tests as findings, anchored to (or within two lines of) these lines:
1. Line 31: `parses_endpoint` asserts only `.is_ok()` and never checks the parsed value (vacuous test).
2. Line 38: `assert_eq!(p, p)` compares a value to itself and cannot fail (tautology).
3. Lines 15 and 44: `verify_checksum` returns a canned `true` and `checksum_ok` passes while proving nothing (stub pass).
4. Line 20: `normalize` is `todo!()` shipped as public behavior.
5. Line 50: `#[ignore] // flaky` silences a real failing test instead of fixing `normalize`.
6. Line 58: `#[allow(clippy::unwrap_used)]` suppresses a production lint with no justification.
Full credit: at least five of the six, with the review explicitly rejecting the merge. Partial credit: three or four. Fail: waves it through because tests pass, or finds two or fewer.
