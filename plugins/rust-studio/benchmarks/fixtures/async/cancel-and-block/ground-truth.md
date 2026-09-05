# Ground truth — async/cancel-and-block (agent: `async-runtime-specialist`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review `Fanout::query` and `Session` for async correctness before this lands on the gateway's hot path. List every finding with file:line and severity, then give a verdict."* Clippy is clean and the integration test passes on a quiet machine; every defect is one `rules/async.md` names.

| id   | line   | type                 | severity | defect |
|------|--------|----------------------|----------|--------|
| GT-1 | 20–25  | MUTEX-ACROSS-AWAIT   | 🔴 | A `std::sync::Mutex` guard on `cache` is held across the `.send().await` on line 24 (the `drop(guard)` comes after). Blocks every other task on the lock for a network round trip and can deadlock the runtime. Release before awaiting, or don't take the lock until the value is ready. |
| GT-2 | 33–36  | SWALLOWED PANIC / HANDLE LEAK | 🔴 | `.unwrap()` ×3 inside `tokio::spawn` — a failed upstream panics the task silently; the `JoinHandle` is dropped so nothing observes it. Return the `Result` from the task and join (a `JoinSet`), or send the `Result` through the channel. |
| GT-3 | 27–36  | UNBOUNDED FAN-OUT    | 🟠 | `unbounded_channel` plus one `spawn` per upstream per request with no semaphore or `buffer_unordered` cap — no backpressure; a burst of requests multiplies by the upstream count. Bound it. |
| GT-4 | 34     | UNBOUNDED AWAIT      | 🟠 | Outbound `.send().await` / `.text().await` with no `tokio::time::timeout`; a stalled upstream stalls the task forever. Every outbound await is bounded. |
| GT-5 | 40     | BLOCKING-IN-ASYNC    | 🔴 | `std::fs::read_to_string` on the executor thread. `tokio::fs` or `spawn_blocking`, and it should not be read per request at all. |
| GT-6 | 46–53  | CANCEL-UNSAFE SELECT / LATENT HANG | 🟠 | The `select!` accumulates into `buf` from a branch that can be cancelled mid-body, and the "timeout" arm is a fresh `sleep(300s)` **recreated every loop iteration**, so it never fires while bodies keep arriving — a 5-minute literal is itself the latent hang `async.md` flags. Create the deadline once outside the loop (or `timeout` the whole aggregation), and keep partial state out of the arm body. |
| GT-7 | 19, 57 | CLOCK IN LIBRARY LOGIC | 🟡 | `Instant::now()` inside the service logic makes the path non-deterministic and untestable under `start_paused`; inject the clock or move the timing to the edge. |
| GT-8 | 66–71  | ASYNC WORK IN DROP   | 🔴 | `Drop` runs `block_on(flush)` — blocking the executor thread from a destructor, and `block_on` inside a tokio runtime panics. `Drop` cannot `.await`: provide `pub async fn close(self) -> Result<()>` and let `Drop` only `tracing::warn!` when it was skipped. |

Pass = GT-1, GT-2, GT-5, GT-8 (the four hard defects) and at least two of GT-3/4/6/7, with a
`NEEDS WORK` verdict. A response that reports the code "compiles and passes tests" without the
mutex-across-await or the `Drop` block_on is the fail this fixture exists for.
