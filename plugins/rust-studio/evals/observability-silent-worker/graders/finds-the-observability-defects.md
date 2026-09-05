---
type: llm
weight: 3
---
The response must find (anchored within two lines):
1. Line 33: the log line prints the customer e-mail and the card token — secrets/PII in a log; redact.
2. Lines 36–39: `let _ = e;` swallows every retry's error with no event, attempt count, or error kind.
3. Lines 41–44: the transition to `Failed` emits nothing — no `tracing::error!` with the last error and invoice id.
It should also flag at least two of: `println!` instead of a structured `tracing` event with fields (line 33); no span/`#[instrument]` and uninstrumented state transitions (lines 27, 32, 42); the "settled once" invariant living only in a comment instead of a `debug_assert!`/metric/typestate (lines 49–54); backoff with no recorded duration or total budget (line 39).
Full credit: all three numbered plus two others and a NEEDS WORK verdict. Partial: three numbered only. Fail: generic "add logging" without the token leak, or two or fewer.
