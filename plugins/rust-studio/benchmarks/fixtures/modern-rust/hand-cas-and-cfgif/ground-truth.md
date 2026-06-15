# Ground truth — modern-rust/hand-cas-and-cfgif (verdict: REDO-TO-BAR)

Compiles on a current toolchain, but every item reaches for a pre-1.95 form the std
has since replaced. The fix requires checking the **current** std (C4 freshness) for
the native spelling, not pattern-matching from stale memory — using the old form because
it still compiles is exactly the miss.

| id   | line  | type        | severity | defect |
|------|-------|-------------|----------|--------|
| GT-1 | 18,23 | HAND-CAS    | 🟠 | `loop { ... compare_exchange_weak(cur, next, ...) }` hand-rolls the retry by hand. The std now exposes the closure form directly: `COUNTER.fetch_update(AcqRel, Relaxed, \|v\| (v < max).then_some(v + 1))` (or atomic `update`/`try_update`, stable 1.95). Replace the loop with the closure update. |
| GT-2 | 32    | CFG-IF      | 🟠 | `cfg_if::cfg_if! { if #[cfg(...)] ... else ... }` pulls in the `cfg-if` crate for compile-time platform selection. Use the std `cfg_select!` macro (1.95) instead — no external dep, same arms (`target_os = "linux" => { ... } _ => { ... }`); add a `_` fallback arm. |
| GT-3 | 51,52 | ADDR-OF     | 🟠 | `addr_of!(h.version)` / `addr_of_mut!(h.flags)` are the pre-1.82 macros. Use the `&raw const h.version` / `&raw mut h.flags` operators — required here anyway because the fields live in a `#[repr(packed)]` struct, so a `&` reference would be UB. |
| GT-4 | 5,10  | ONCE-CELL   | 🟠 | `once_cell::sync::Lazy<Vec<&str>>` for a global is the pre-1.80 dep. Use `std::sync::LazyLock` (`static REGISTRY: LazyLock<Vec<&'static str>> = LazyLock::new(\|\| ...)`) — drop the `once_cell` (and any `lazy_static`) dependency for new code. |

Pass = agent returns **REDO-TO-BAR** AND signals it should check the current std before
choosing; modernize GT-1..GT-4. Using the stale pattern because it compiles is the miss.
