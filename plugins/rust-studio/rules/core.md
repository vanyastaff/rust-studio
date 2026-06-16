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
  semantics are right, not reflexively. Order derives common -> specific:
  `#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]`.
- Avoid `as` casts that can truncate; use `TryFrom`/`try_into` and handle the error.
- Integer overflow is **defined**, not UB: debug panics, release wraps (two's complement).
  On untrusted numbers reach for `checked_`/`saturating_`/`wrapping_`/`overflowing_`
  (or `Wrapping<T>`/`Saturating<T>`) to state the intended semantics explicitly.

## Idiom
- Iterators over manual index loops; `?`-friendly combinators over nested matches.
- No needless `.clone()` to satisfy the borrow checker — restructure or borrow.
- `#[must_use]` on builders, `Result`-like returns, and guard types — anywhere a silently
  discarded value is a bug.
- Modules small and cohesive; `pub(crate)` by default, `pub` only when intended.
- `mem::take`/`mem::replace` to move a value out behind `&mut` for enum-variant transitions;
  prefer `Option::take()` over `mem::take(opt)`, and `mem::replace(field, placeholder)` when
  the type is not `Default`.
- Iterate an `Option` via `.iter()`/`.chain()`/`.extend()`/`filter_map` — never `for x in opt`
  (use `if let Some(x) = opt` for the single value).
- Cut nesting with `let-else` and let-chains. Prefer the `cfg_select!` macro over the
  `cfg-if` crate for compile-time branching in new code.
- `if let` guards in `match` arms do **not** count toward exhaustiveness — always pair a
  guarded arm with a non-guarded or wildcard arm covering the same case.

## Drop & raw pointers
- Variables drop in **reverse** declaration order within a scope; struct/tuple/variant fields
  drop in **declaration** order; array/slice elements drop first-to-last. When a `Drop` impl or
  an `Rc`/`Arc` cycle depends on teardown sequence, order the fields to match.
- RAII guards: bind to `_g`/`_guard`, never bare `_` (bare `_` drops at statement end, not scope
  end). Never wrap a guard in `Rc`/`Arc` — its lifetime would escape the scope it protects.
- `Drop` is **best-effort, not guaranteed**: it is skipped on `mem::forget`, `Rc`/`Arc` reference
  cycles, `process::exit`/`abort`, and the second of a double-panic. Do not rely on it for critical
  finalization (WAL flush, releasing external locks) — provide an explicit `close()` and document
  `Drop` as best-effort.
- Take a raw pointer with `&raw const x` / `&raw mut x`, never `&x as *const _` (that forms a
  reference first — UB on unaligned, uninitialized, or `#[repr(packed)]` places).

## Hygiene
- Zero `cargo clippy --all-targets --all-features -- -D warnings`.
- `cargo fmt` clean. No commented-out code, no stray `dbg!`/`println!` debugging.
- No `#[allow(...)]` without a one-line justification comment.
- `TODO`/`FIXME` include an owner or issue reference, else they are not allowed.
- No plan/task IDs or phase markers (`TODO(A-5)`, "Phase B") in committed code — write the
  invariant a future change enforces, not the plan id that schedules it.

## Modern idioms & recurring misses
- Verify idioms against the **current** toolchain (edition 2024; check official Rust
  release notes/std docs for the current stable version) — prefer native async-fn-in-trait /
  RPITIT over `async-trait`, `OnceLock`/`LazyLock`, `let-else`/`let-chains`.
  Don't default to `Arc<Mutex<_>>` / `Rc<RefCell<_>>`. Prefer making the wrong path
  *syntactically absent* (visibility, scoped borrows, newtypes) over a "remember to call me" helper.
- `map.entry(k).or_default()` — one lookup, not `get(&k)` then `entry()` on miss.
- `expect`/`panic!`/`unreachable!` messages name the **broken invariant and how to avoid it**,
  not the function name.
- `Vec` has **no** small-buffer optimization — `push` heap-allocates; the struct field holds
  only the `(ptr,len,cap)` header. Use `smallvec`/`arrayvec` when inline-size matters.
- Complexity comments state **average AND worst case** (+ a bounding note when N is bounded).

## Integrity & discipline (not optional)
The goal is correct behavior, not a green checkmark. Make the code satisfy the test — **never**
weaken, `#[ignore]`, delete, or rewrite a test (or its assertion) to go green; a genuinely wrong
test is a behavior decision — surface it, don't flip it silently.
- A **behavior** change rides on a test that **failed before the fix** (red→green). A test that
  can't fail (asserts `is_ok()` not the value, a tautology, happy-path-only, no assertion) doesn't count.
- A self-authored test proves *no regression*, not *correctness* — correctness is vs the acceptance
  criteria / an oracle / a property law. Report pass-rate & coverage with the **full denominator**;
  name what's skipped/ignored and why — never silently drop it from the count.
- No stub / `todo!()` / canned-constant return / phase-marker where real behavior is required.
- A non-trivial change earns a **pre-code shape verdict** and a **pre-merge review**; skipping the
  disciplined path *to go faster* is the quick-win this studio rejects. Green is the floor.
- `#[allow(...)]` needs a one-line justification; never re-open a workspace `forbid`/`deny` by
  redefining a crate `[lints]` table (it **replaces**, not merges, the workspace table).
See `${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`.

## Definition of done (observability ships in the same pass)
A change that adds/modifies a state, error variant, hot path, or cross-crate call ships its
observability now, not as a follow-up: a typed error variant (`#[source]` chains, not `String`),
a `#[tracing::instrument]`/span with meaningful fields, and any prose invariant turned into a
`debug_assert!` or type-level guarantee. Green tests are not "done"; finishing the cross-crate
ripple is. See `${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`.
