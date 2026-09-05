# Ground truth — architecture/upward-dependency (verdict: RESHAPE NEEDED)

> Mapped agent is `chief-architect` (a pre-code lead); its reject token is **RESHAPE NEEDED**
> (`REDO-TO-BAR` from `rust-reviewer` also counts). Audit prompt the fixture is calibrated for:
> *"We are about to add a `refund` flow to `acme-domain`. Is this crate in shape to extend? Give
> the pre-code maintainer verdict."* The workspace compiles and tests are green; the defects are
> the dependency direction and the boundaries (`rules/architecture.md` §Layering, §Ownership
> boundary first), which a reviewer reading one diff at a time never sees.

| id   | line        | type                        | severity | defect |
|------|-------------|-----------------------------|----------|--------|
| GT-1 | 8, 37, 42, 51, 85 | UPWARD DEPENDENCY (transport type in the domain) | 🔴 | The lowest layer imports `axum::http::StatusCode` and uses an HTTP status as an invoice's *lifecycle state*. Every consumer now compiles axum, and "402 = unpaid" is a domain fact encoded in a transport vocabulary. Cut an `InvoiceStatus` enum owned here; `acme-api` maps it to HTTP at its own edge. |
| GT-2 | 9, 41, 45–50, 60, 92 | STORAGE IN THE DOMAIN | 🔴 | `sqlx::PgPool` in a domain signature and a SQL string in a domain function. The rule that decides *whether* an invoice may settle is now inseparable from *how* it is persisted, and untestable without Postgres. Depend on a trait at the boundary (`InvoiceRepository` / `SettleInvoices`) that `acme-worker`/`acme-api` implement (DIP). |
| GT-3 | 41, 43, 50, 103–106 | DEPENDENCY CYCLE, HIDDEN | 🔴 | `settle` returns `acme_api::ApiError` while `acme-api` depends on `acme-domain`; the cycle only compiles because `acme-api` is smuggled in as a *dev*-dependency (which `cargo` permits) while a non-test signature names it. The error type belongs **down** — a `SettleError` here, converted to `ApiError` in `acme-api`. Any extension (the `refund` flow) grows this knot. |
| GT-4 | 12–28       | UTILS GROWTH                | 🟠 | `slugify`, `parse_env_bool`, `now_millis` have no domain meaning and each exists for one *upstream* consumer. `utils` in the lowest crate is where every layer dumps what it did not want to own. Move each to the crate that uses it, or a tiny leaf `acme-support` if two share one — and question whether `parse_env_bool` belongs anywhere but the binaries. |
| GT-5 | 56–61, 80–90 | GOD STRUCT, CLONE-TO-APPEASE | 🟠 | `Ledger` owns entries, an index, metrics, and a connection pool; `settle_all` clones the whole entry list because `&mut self` on `bump_settled` locks fields it never touches. The contention maps onto real concepts (`LedgerMetrics` is already a type) — split so borrows are independent, and the clone disappears (`rules/architecture.md` §Struct decomposition). The pool does not belong in the ledger at all (GT-2). |
| GT-6 | 5–6         | PRE-CODE CALL               | 🟣 | The right answer to "add `refund` here" is *not yet*: adding a flow on top of GT-1…GT-3 extends the knot (`Extend over reshape`). Reshape the boundary first (an ADR-grade change — `/architecture`, then `/adr`), then the flow is a small, testable domain function. |

Pass = **RESHAPE NEEDED** naming the dependency direction (GT-1 and GT-3 at minimum) and
proposing the concrete re-cut (domain-owned status enum + error type, persistence behind a trait).
GT-2, GT-4, GT-5 separate a correct verdict from a complete one. A response that answers "the
crate compiles and the tests are green, add `refund` alongside `settle`" is the fail this fixture
exists for.
