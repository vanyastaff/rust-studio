---
name: core
paths: "**/*.rs"
description: Core idiomatic Rust standards for every .rs file
---

# Core Rust Standards

Applies to every `.rs` file.

## Errors & panics
- Libraries return `Result`; they do **not** `panic!`/`unwrap`/`expect` on
  recoverable conditions. `unwrap`/`expect` are allowed only when a comment proves
  the invariant, in tests, or in `main`/examples.
- Prefer `?` over `match`-and-rewrap. Add context at boundaries (`.with_context(...)`
  / a typed error variant), not at every call.
- `expect("...")` messages state the invariant that must hold, not "should never happen".
- No `unwrap()` on `Option`/`Result` in library code paths reachable by callers.

## Ownership & types
- Take the cheapest sufficient borrow: `&str` over `&String`, `&[T]` over `&Vec<T>`,
  `impl AsRef<Path>` for path args. Return owned values; borrow in parameters.
- Make illegal states unrepresentable: prefer enums/newtypes over bool flags and
  stringly-typed data. Parse, don't validate.
- Derive `Debug` on public types. Derive `Clone`/`Copy`/`PartialEq` only when the
  semantics are right, not reflexively.
- Avoid `as` casts that can truncate; use `TryFrom`/`try_into` and handle the error.

## Idiom
- Iterators over manual index loops; `?`-friendly combinators over nested matches.
- No needless `.clone()` to satisfy the borrow checker — restructure or borrow.
- `#[must_use]` on functions whose result must be used (builders, `must_use` returns).
- Modules small and cohesive; `pub(crate)` by default, `pub` only when intended.

## Hygiene
- Zero `cargo clippy --all-targets --all-features -- -D warnings`.
- `cargo fmt` clean. No commented-out code, no stray `dbg!`/`println!` debugging.
- No `#[allow(...)]` without a one-line justification comment.
- `TODO`/`FIXME` include an owner or issue reference, else they are not allowed.
- No plan/task IDs or phase markers (`TODO(A-5)`, "Phase B") in committed code — write the
  invariant a future change enforces, not the plan id that schedules it.

## Modern idioms & recurring misses
- Verify idioms against the **current** toolchain (edition 2024, Rust ≥1.94) — prefer native
  async-fn-in-trait / RPITIT over `async-trait`, `OnceLock`/`LazyLock`, `let-else`/`let-chains`.
  Don't default to `Arc<Mutex<_>>` / `Rc<RefCell<_>>`. Prefer making the wrong path
  *syntactically absent* (visibility, scoped borrows, newtypes) over a "remember to call me" helper.
- `map.entry(k).or_default()` — one lookup, not `get(&k)` then `entry()` on miss.
- `expect`/`panic!`/`unreachable!` messages name the **broken invariant and how to avoid it**,
  not the function name.
- `Vec` has **no** small-buffer optimization — `push` heap-allocates; the struct field holds
  only the `(ptr,len,cap)` header. Use `smallvec`/`arrayvec` when inline-size matters.
- Complexity comments state **average AND worst case** (+ a bounding note when N is bounded).

## Definition of done (observability ships in the same pass)
A change that adds/modifies a state, error variant, hot path, or cross-crate call ships its
observability now, not as a follow-up: a typed error variant (`#[source]` chains, not `String`),
a `#[tracing::instrument]`/span with meaningful fields, and any prose invariant turned into a
`debug_assert!` or type-level guarantee. Green tests are not "done"; finishing the cross-crate
ripple is. See `${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`.
