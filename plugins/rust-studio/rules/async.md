---
name: async
paths: "**/handlers/**,**/routes/**,**/server/**,**/service/**,**/api/**"
description: Async / tokio / web-service standards
---

# Async & Service Standards

Applies to async service code (handlers, routes, servers, services).

## Don't block the runtime
- No blocking calls in `async fn`: no `std::fs`, blocking DB drivers, `std::thread::sleep`,
  CPU-heavy loops, or `Mutex` held across `.await`. Use async equivalents or
  `tokio::task::spawn_blocking` for unavoidable blocking work.
- Use `tokio::sync::Mutex` only when you must hold a lock across `.await`; otherwise a
  `std::sync::Mutex` released before awaiting is faster and avoids cancellation hazards.

## Cancellation & correctness
- Every `.await` is a cancellation point. Code must be correct if dropped there —
  no half-applied state. Prefer atomic commit (write-then-swap) over multi-step mutation.
- `select!` branches must be cancellation-safe; document which futures are not.
- Spawned tasks: handle the `JoinHandle` (don't leak panics); propagate errors.
- Bound concurrency (semaphores, `buffer_unordered`) — never spawn unbounded per request.

## Bounds & types
- Futures crossing `spawn` need `Send + 'static`. Keep `!Send` types (e.g. `Rc`) out
  of awaited scopes. Prefer owned data into tasks over borrowed.
- Backpressure: bounded channels; return `503`/shed load rather than growing queues.

## Web layer
- Extractors validate input at the boundary; handlers receive typed, valid data.
- Errors implement `IntoResponse` with correct status codes; never leak internals or
  `?`-bubble a DB error straight to the client body.
- Timeouts and cancellation on every outbound call; no unbounded awaits on I/O.
- Instrument handlers with `tracing` spans (see observability).
