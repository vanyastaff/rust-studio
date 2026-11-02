# Persistence

Use for SQL drivers, migrations, transactions, row types and pools. Read
`references/database.md`; load `async.md` for runtime integration and
`security.md` for untrusted-input and row-authorization paths.

- Map every persistence touchpoint and migration ordering; inspect applied state with the
  driver's migration tooling. Specify forward/backward behavior, idempotency and rollback
  limits. Live destructive migration requires its own authorization.
- Bind data parameters (`$1`/`?` or builder binds); never interpolate user data into SQL.
  Validate dynamic identifiers against an allowlist. Prefer checked query!/query_as! where
  practical; record why runtime-shaped queries cannot use compile-time checking.
- Size pools for deployment: max connections, acquisition/idle timeouts, health and shutdown
  lifecycle. Synchronous drivers need a blocking boundary outside the async executor.
- Trace loops for N+1 queries; compare batches/joins/cursors and inspect indexes with EXPLAIN
  or EXPLAIN ANALYZE. State atomic operations, isolation level, savepoints and cancellation
  behavior for every transaction.
- Row projections preserve nullability as Option and use domain types for IDs/money.
  Query failures remain typed errors; ownership and authorization survive row mapping.

Return migration up/down or recovery plan, pool settings and changed query plans with
dry-run/query evidence. An unreachable database is an explicit validation gap, not a pass.
