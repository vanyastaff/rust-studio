# Ground truth — reviewer/drop-and-dyn (agent: rust-reviewer)

Planted defects in `input.rs`. The agent should catch each.

| id   | line | type             | severity | defect |
|------|------|------------------|----------|--------|
| GT-1 | 25   | DURABILITY/DROP  | 🔴 | `Wal` flushes to disk **only** in its `Drop` impl (lines 25–31) yet the doc (lines 12–13) sells that as durability. `Drop` is best-effort — skipped on `mem::forget`, `Rc`/`Arc` cycles, `process::exit`/`abort`, and the second of a double-panic — so buffered records are silently lost. Provide an explicit `flush()`/`close(self) -> io::Result<()>` callers must invoke; document `Drop` as best-effort only. Also: the `write_all`/`flush` errors are swallowed by `let _ =`. |
| GT-2 | 41   | LOCK/DROP        | 🔴 | `let _ = self.mutex_guard();` binds the `MutexGuard` to bare `_`, which drops **at the end of the statement**, not the scope — the lock is released immediately, so the "held while building derived state" comment is false and the line-43 insert races. Bind to `_g`/`_guard` (e.g. `let _guard = self.mutex_guard();`) to hold it for the rest of `put`. |
| GT-3 | 59   | API/ERROR        | 🟠 | `pub fn parse(s: &str) -> Result<Config, Box<dyn std::error::Error>>` in a **library** returns an untyped boxed error: callers can't match on failure modes. Define a typed error (`thiserror` enum with `#[source]` chains). The box also lacks `+ Send + Sync`, so the error can't cross threads — required for most library boundaries. Use a concrete error type, or at minimum `Box<dyn std::error::Error + Send + Sync>`. |
| GT-4 | 90   | DYN-COMPAT       | 🔴 | `Repo` is used as `dyn Repo` (lines 95, 99), but `fn query<Q: Into<String>>(&self, q: Q)` adds a **generic** method with no `where Self: Sized` — a generic method is not dispatchable, so this breaks `dyn`-compatibility and `Box<dyn Repo>` no longer compiles. Mark it `where Self: Sized`, take `q: &str` (or `String`) instead of a generic, or factor the dyn subset into a supertrait. |

Pass = all four caught. A miss is a gap in the `rust-reviewer` prompt, not a
reason to relax the fixture.
