# Ground truth — database/n-plus-one-and-txn (agent: `database-specialist`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review this sqlx repository module before it goes to production load. List every finding with file:line and severity, then give a verdict."* Every query returns the right rows in the test database; every defect is one `rules/database.md` names.

| id   | line   | type                          | severity | defect |
|------|--------|-------------------------------|----------|--------|
| GT-1 | 24     | SQL INJECTION VIA IDENTIFIER  | 🔴 | `ORDER BY {sort_by}` interpolates a caller-supplied identifier into the query text. Identifiers cannot be bound; validate `sort_by` against a fixed allowlist (an enum) and map to the column name. |
| GT-2 | 27–30  | N+1                           | 🔴 | One `count(*)` query per order row inside the loop. A single `LEFT JOIN … GROUP BY` or `WHERE order_id = ANY($1)`. |
| GT-3 | 18–19, 23 | POOL PER CALL, OVERSIZED, NO TIMEOUT | 🔴 | A new `PgPool` is built on every `list_sorted` call, with `max_connections(500)` (exceeds any sane Postgres limit shared across instances) and no `acquire_timeout` — exhaustion hangs instead of failing fast. One shared pool per process, sized to the server, with acquire/idle/lifetime timeouts. |
| GT-4 | 37–38  | UNESCAPED `LIKE` PATTERN      | 🟠 | `%{term}%` from user input — `%` and `_` in `term` become wildcards (a bare `%` matches everything). Escape them, or bind with an explicit `ESCAPE`. |
| GT-5 | 43–48  | HTTP CALL INSIDE A TRANSACTION | 🔴 | `reqwest::get(...).await` between the two `UPDATE`s holds row locks for a network round trip; a slow ledger stalls every concurrent transfer, and the result is discarded anyway. Commit first, notify after (or enqueue the notification). |
| GT-6 | 11, 42 | `f64` FOR MONEY               | 🔴 | `total: f64` and `amount: f64` — binary floating point cannot represent cents exactly; a `Decimal`/`i64` minor-units newtype. |
| GT-7 | 31     | `unwrap()` ON A NULLABLE COLUMN | 🟠 | `note` is nullable and `.unwrap()`ed in a repository path — a NULL row panics the request. `Option<String>` in the model. |
| GT-8 | 9–10   | BARE `i64` IDS                | 🟡 | `id`, `customer_id`, `from`, `to` are bare `i64`; `transfer(pool, from, to, …)` swaps silently. Newtypes (`OrderId`, `CustomerId`, `AccountId`). |

Pass = GT-1, GT-2, GT-5, GT-6 and at least two of the others, with a `NEEDS WORK` verdict.
"Queries are parameterized" while the `ORDER BY` interpolation stands is the fail.
