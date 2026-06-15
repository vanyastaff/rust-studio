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
- A bare `.unwrap()`/`.expect()` inside `tokio::spawn` swallows the panic — the task dies
  silently. Return the `Result` from the task and propagate at the join site:
  `let res = handle.await.expect("task panicked")?;`.

## Async teardown & RAII
- `Drop` cannot `.await`. Never attempt async cleanup in a destructor. Provide an explicit
  `pub async fn close(self) -> Result<()>` that flushes/finalizes, and let `Drop` be
  best-effort: emit a `tracing::warn!` if `close()` was skipped, nothing more.
- Don't reinvent RAII with a manual `close()` call at every return point — if cleanup is
  "run on scope exit" and needs no `.await`, that's a `Drop` impl, not bookkeeping.
- Bind an RAII guard (`MutexGuard`, file, transaction) in a `let` *before* a `match`, never
  inside the match scrutinee. A guard temporary built in the scrutinee has a subtle,
  version-sensitive hold lifetime; the explicit `let` makes the held region obvious and stable.
  Write `let g = data.lock().unwrap(); match g.value { … }`, not `match data.lock().unwrap().value { … }`.

## Bounds & types
- Futures crossing `spawn` need `Send + 'static`. Keep `!Send` types (e.g. `Rc`) out
  of awaited scopes. Prefer owned data into tasks over borrowed.
- Backpressure: bounded channels; return `503`/shed load rather than growing queues.

## Async traits & dispatch
- `async fn` in traits is stable but NOT dyn-compatible by default (the hidden `impl Future`
  is non-dispatchable). Default to static dispatch (`fn use_repo<R: Repo>(r: &R)`). When you
  genuinely need `dyn`, derive a shim with `trait-variant`/`dynosaur`, or hand-write a parallel
  trait returning `Pin<Box<dyn Future<Output = _> + Send + 'a>>`. Same applies to `-> impl Trait`
  (RPITIT) methods — opaque per impl, not dyn-compatible.
- Growing a `dyn`-used trait with a generic method silently breaks `dyn`. Catch it before
  committing: mark the new method `where Self: Sized`, or factor the dyn subset into a supertrait.
- Use async closures / `AsyncFn*` (1.85) where `impl Fn(&T) -> impl Future` fails the HRTB /
  borrow-across-`.await` problem — async closures may borrow their argument across the await.
- On-stack dynamic dispatch (1.79+): a `&mut dyn Trait` bound at function scope needs no `Box`
  for conditional dispatch. Prefer it over `Box<dyn _>` when the object doesn't outlive the call:
  `let r: &mut dyn Read = if cond { &mut io::stdin() } else { &mut File::open(p)? };`.
- Don't mark a fn `async` if it never `.await`s — it just wraps the body in a needless future.
  Don't `Box::pin` a future to silence the compiler; first try `use<…>` precise capturing (1.82)
  to narrow what the opaque type captures, or restructure the lifetimes.

## Web layer
- Extractors validate input at the boundary; handlers receive typed, valid data.
- Errors implement `IntoResponse` with correct status codes; never leak internals or
  `?`-bubble a DB error straight to the client body.
- Timeouts and cancellation on every outbound call; no unbounded awaits on I/O.
- Instrument handlers with `tracing` spans (see observability).
