# Async execution

Use for runtimes, spawning, streams, async traits, cancellation and shutdown. Read
`${CLAUDE_PLUGIN_ROOT}/rules/async.md`; load `systems.md` for shared-memory soundness,
`web.md` for HTTP, `data.md` for persistence and `observability.md` for instrumentation.

- Record runtime topology, executor/blocking pools and the actual fan-out/pipeline shape.
  Synchronous I/O, CPU loops and blocking FFI need an appropriate blocking boundary.
- Inventory every spawn and account for each JoinHandle/JoinSet: joined, deadline-aborted
  or explicitly justified detachment. Verify required `Send + 'static` bounds.
- Trace state at every `.await`, losing `select!` arm and timeout cancellation point.
  Dropping a future must preserve invariants; test partial progress and cancellation.
  Review fairness, biased polling and missed wakeups against the intended service policy.
- Blocking mutex guards across `.await` are defects. An async guard spanning I/O needs
  justified scope, lock ordering, contention and cancellation behavior. Bind guards before
  match/select scrutinees so their hold/drop spans are explicit.
- Bound queues, task fan-out and stream buffers; specify backpressure, termination and I/O
  deadlines. A sleep recreated inside a loop may restart forever: preserve the deadline.
  Inject clocks at library boundaries so timing tests can use paused time.
- Propagate shutdown cancellation, drain in-flight work, join/abort tasks with a deadline
  and define cleanup order. Resources requiring flush/commit/release expose explicit async
  close; Drop cannot await and is a best-effort warning/backstop for skipped close.
- Use native async traits where the MSRV permits; dyn use needs a deliberate compatible
  interface. Check precise future capture and async closures before heap boxing. A body
  without awaits may be synchronous; conditional dispatch may use a scoped borrowed dyn value.

## ASYNC-GATE

Every await/spawn/lock on the changed paths has cancellation and lifecycle evidence; no
blocking work occupies the executor; concurrency and I/O deadlines are bounded. Errors map
to appropriate responses without internal disclosure. Tracing, key metrics and shutdown
tests are part of completion. Report spawn accounting and any untested cancellation paths.
