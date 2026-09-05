# Ground truth — error-model/stringly-and-lost-source (agent: `error-architect`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"We are about to publish 1.0 of `acme-store`. Review its error handling and error types as the crate's public contract. List every finding with file:line and severity, then give a verdict."* Every defect is one `rules/error-model.md` names.

| id   | line   | type                        | severity | defect |
|------|--------|-----------------------------|----------|--------|
| GT-1 | 10     | STRINGLY ERROR TYPE         | 🟠 | `StoreError(pub String)` is a stringly error with one variant and no `source`. A published library needs a `thiserror` enum with domain variants (`Io`, `Config`, `EmptyKey`, `Timeout`, …), `#[non_exhaustive]`. |
| GT-2 | 31, 38, 51 | `Box<dyn Error>` ON A LIBRARY SURFACE | 🔴 | Three public functions return `Box<dyn Error>`; callers cannot match on failure modes and every future change is invisible to semver tooling. Return the typed enum. |
| GT-3 | 38     | NOT `Send + Sync` ACROSS A TASK | 🔴 | The boxed error crosses `tokio::spawn` as bare `dyn Error` (no `+ Send + Sync`) — the spawned future is not `Send`, and even where it compiled the auto traits are missing from the contract. A typed error, or at minimum `Box<dyn Error + Send + Sync>`. |
| GT-4 | 32–33  | SOURCE CHAIN FLATTENED      | 🟠 | `toml` error → `e.to_string()` discards the cause (line and column); `?` on `io::Error` erases it into the box. Preserve with `#[from]` / `#[source]` variants. |
| GT-5 | 56–57  | ERRORS MATCHED BY STRING    | 🔴 | `is_retryable` decides retry policy by `.contains("timed out")` — a message edit silently changes behavior. Match variants (`Timeout`, `ConnectionReset`), or carry a `kind()`. |
| GT-6 | 24–27, 52 | SECRET LEAKED THROUGH `Debug` | 🔴 | The hand-written `Debug` prints `api_token`, and `flush` puts `{:?}` of the credentials into the error message that reaches logs and callers. Redact (`secrecy::Secret` or a `Debug` that prints `[redacted]`), and never format credentials into an error. |
| GT-7 | 70–71  | PANIC ON ENVIRONMENT FAILURE IN BOOTSTRAP | 🟠 | `bootstrap` `.expect()`s on a missing/invalid config — a recoverable misconfiguration reported as a panic. Return `Result` up to `main`; only `main` maps to an exit code. |
| GT-8 | 60     | FALLIBLE-CONSUME DROPS THE VALUE | 🟡 | `put(key: String, value: Vec<u8>)` takes both by move and on error drops them; a caller who wants to retry must clone up front. Return the consumed value in the error (`PutError { key, value, kind }`) or borrow. |

Pass = GT-2, GT-3, GT-5, GT-6 and at least two of the others, with a `NEEDS WORK` verdict.
Approving the surface for 1.0 with `Box<dyn Error>` on it is an automatic fail.
