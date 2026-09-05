---
type: llm
weight: 3
---
The response must reject extending the crate as-is and name the dependency-direction defects (anchored to or within two lines of these lines):
1. Lines 8, 37, 42, 51: `axum::http::StatusCode` is used as an invoice's lifecycle state inside the domain crate — a transport type flowing UP into the lowest layer; the fix is a domain-owned `InvoiceStatus` enum mapped to HTTP at the API edge.
2. Lines 9, 41, 45–50, 60: `sqlx::PgPool` and a SQL string inside a domain function — storage in the domain; the fix is a trait at the boundary that `acme-api`/`acme-worker` implement, so the settle rule is testable without Postgres.
3. Lines 41, 43, 50 and the Cargo excerpt at 103–106: `settle` returns `acme_api::ApiError` while `acme-api` depends on `acme-domain` — a dependency cycle hidden behind a dev-dependency back-edge; the error type belongs down (a `SettleError` here, converted upstream).
It should also flag: the `utils` module (12–28) whose helpers each serve one upstream crate and have no domain meaning; and `Ledger` (56–61, 80–90) as a struct whose `&mut self` methods contend on disjoint fields so `settle_all` clones the whole list — split along the concept boundary (`LedgerMetrics` already exists) and remove the pool from it.
Full credit: all three numbered defects with the concrete re-cut, plus the verdict that the boundary is reshaped BEFORE `refund` is added (an `/architecture` / ADR-grade change, not a line patch). Partial: two of the three. Fail: one or none, or it answers that the crate compiles and tests are green so `refund` can be added next to `settle`.
