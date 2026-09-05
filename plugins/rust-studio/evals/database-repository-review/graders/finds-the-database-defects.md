---
type: llm
weight: 3
---
The response must find (anchored within two lines):
1. Line 24: `ORDER BY {sort_by}` interpolates a caller-supplied identifier into SQL — injection; identifiers cannot be bound, so validate against an allowlist/enum.
2. Lines 27–30: a `count(*)` query per order row inside the loop — N+1; one JOIN/GROUP BY or `= ANY($1)`.
3. Lines 43–48: an HTTP call (`reqwest::get`) between the two UPDATEs inside the transaction — row locks held across a network round trip.
4. Lines 11, 42: `f64` for money (`total`, `amount`).
It should also flag at least two of: a new `PgPool` built per call with `max_connections(500)` and no acquire timeout (lines 18–19, 23); the unescaped `LIKE` pattern (`%`/`_` in `term` become wildcards, lines 37–38); `.unwrap()` on the nullable `note` column (line 31); bare `i64` ids that `transfer(from, to)` can swap silently (lines 9–10, 42).
Full credit: all four numbered plus two others and a NEEDS WORK verdict. Partial: three numbered. Fail: says the queries are parameterized and safe, or two or fewer.
