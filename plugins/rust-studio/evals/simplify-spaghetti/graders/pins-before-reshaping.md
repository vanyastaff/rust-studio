---
type: llm
weight: 3
---
The only test (line 111) asserts `.is_ok()` and cannot fail, so the code's current behavior is unpinned. A correct response establishes the oracle BEFORE it restructures anything: it says the existing test proves nothing, proposes characterization tests that record today's outputs across the `kind` × `vip` × `retry` × `dry` paths including the exact error strings (and/or snapshot tests), and says how it would confirm those tests can go red (break one branch on purpose, watch the failure, revert). Only then does it reshape, in small steps, re-running the tests after each.
Full credit: pin-first is explicit and ordered before any rewrite, with the calibration step. Partial: characterization tests are proposed but ordering is unclear, or no calibration. Fail: the response rewrites or restructures the function as its first move, proposes "adding tests afterwards", or treats the existing green test as evidence that behavior is preserved.
