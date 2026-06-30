---
name: database
paths: "**/migrations/**,**/repository*.rs,**/repositories/**,**/db/**,**/queries/**,**/models/**,**/schema.rs,**/entity/**,**/entities/**"
description: Rust database / persistence standards (sqlx, diesel, sea-orm)
---

# Database & Persistence Standards

Applies to persistence code: migrations, repositories, query modules, row models.
Owned by `database-specialist`. Injection-boundary concerns also feed `security.md`
(owned by `security-auditor`).

## Query construction — injection safety (REQUIRED)
- Parameterize every query. Use bound parameters (`$1`/`?`), sqlx `query!`/`query_as!`,
  diesel's DSL, or a builder's `.bind(...)`. **Never** build SQL with `format!`, `+`, or
  `push_str` on untrusted input — that is a SQL-injection hole.
- A dynamic identifier (table/column/sort key chosen at runtime) cannot be bound as a
  parameter: validate it against a fixed allowlist of known identifiers, never pass the
  raw string through.
- `LIKE` patterns from user input: escape `%` and `_` (or use a parameter + explicit
  `ESCAPE`), or the input controls the wildcard.

## Compile-time checking
- Prefer compile-time-verified queries: sqlx `query!`/`query_as!` (needs `DATABASE_URL` or
  a committed `.sqlx/` offline cache), or diesel's typed DSL. Reserve runtime/dynamic SQL
  for genuinely runtime-shaped queries and note why.
- Commit the sqlx offline cache (`cargo sqlx prepare`) so CI builds without a live DB.

## Connection pool
- One shared pool for the process; never open a connection per request. Size it to the
  database's real limit, not an arbitrary large number — `max_connections` should respect
  the server's `max_connections` shared across all app instances.
- Always set an acquire timeout (so a pool-exhaustion bug fails fast instead of hanging)
  and a sane idle/`max_lifetime` so dead connections are recycled.
- Never hold a pooled connection across an `.await` that doesn't need the DB (e.g. an HTTP
  call): acquire late, release early.

## Transactions
- Define atomic boundaries explicitly: begin → work → commit, with `?`-driven rollback on
  the error path (RAII transaction guards roll back on drop — rely on it, don't leak a
  half-open transaction).
- Keep transactions short; never await unrelated I/O inside one (it holds locks). Pick the
  isolation level deliberately; use a savepoint for partial rollback rather than re-running
  the whole transaction.

## Query performance
- No N+1: a query issued per row in a loop must become a single `JOIN`, `WHERE id = ANY($1)`,
  or a batched load. Prove the fix with `EXPLAIN (ANALYZE)` where the DB is reachable.
- Ensure indexes back every `WHERE`/`JOIN`/`ORDER BY` on a hot path; add the index in the
  same migration as the query that needs it.
- Paginate with keyset/cursor (`WHERE id > $last`) over large `OFFSET` for deep pages.

## Migrations
- Every migration is reversible (a real `down`, or a documented reason it's irreversible)
  and idempotent where feasible. Never edit an already-applied migration — add a new one.
- Order by timestamp prefix; check for ordering conflicts before adding one.
- Destructive migrations (drop column/table, type narrowing) on live data are a
  direction-changing fork — surface to the user, and prefer expand→migrate→contract.

## Row mapping
- Map DB-nullable columns to `Option<T>`; do not `unwrap` a nullable column.
- Wrap domain IDs and money in newtypes (`UserId(i64)`, a decimal money type) — never pass
  bare `i64`/`f64`; floating point for money is a correctness bug.
- No `unwrap`/`expect` on query results in library/repository paths — propagate `Result`.
