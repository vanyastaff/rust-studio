# Ground truth — observability/silent-state-change (agent: `observability-engineer`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"This settlement worker 'works', but when it fails in production nobody can tell why from the logs. Review its observability and diagnostics. List every finding with file:line and severity, then give a verdict."* Every defect is one `rules/observability.md` names.

| id   | line   | type                          | severity | defect |
|------|--------|-------------------------------|----------|--------|
| GT-1 | 33     | SECRETS / PII IN A LOG LINE   | 🔴 | The one log line prints the customer's e-mail **and the card token**. Redact: log `invoice_id` and a token fingerprint at most, never the token or the e-mail. |
| GT-2 | 33     | `println!` IN SERVICE CODE    | 🟠 | Unstructured stdout instead of a `tracing` event with fields (`invoice_id`, `attempt`, `outcome`). |
| GT-3 | 36–39  | SWALLOWED ERROR IN THE RETRY PATH | 🔴 | `let _ = e;` — each failed attempt is discarded with no event, no `attempt` field, no error kind; a run that takes five tries looks identical to one that takes one. `tracing::warn!(attempt, error = %e, …)` per retry. |
| GT-4 | 41–44  | TERMINAL FAILURE WITH NO SIGNAL | 🔴 | The `Failed` transition emits nothing at all — the exact case that needs a `tracing::error!` with the last error and the invoice id. |
| GT-5 | 27, 32, 42 | STATE TRANSITIONS UNINSTRUMENTED | 🟠 | Three lifecycle transitions and no span or event marks any of them; `run` has no `#[instrument(skip(self, job), fields(invoice_id = job.invoice_id))]`. |
| GT-6 | 49–54  | INVARIANT IN PROSE ONLY       | 🟠 | "settled once, gateway not idempotent" lives in a comment. Make it visible: a `debug_assert!(matches!(job.state, State::Pending))` at entry, a metric/event on a double-settle attempt, or a typestate. |
| GT-7 | 39     | UNBOUNDED / UNOBSERVED BACKOFF | 🟡 | The backoff sleeps without a recorded duration or a total-time budget; nothing tells an operator how long a job sat retrying. Record `backoff_ms` and bound the total. |

Pass = GT-1, GT-3, GT-4 and at least two of the others, with a `NEEDS WORK` verdict. Suggesting
"add some logging" without naming the token leak is the fail.
