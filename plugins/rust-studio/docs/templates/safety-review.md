<!-- Rust Code Studio template — copy into your project and fill in every placeholder before merging unsafe code. -->

# Safety Review: <module/function>

*e.g. `collections::raw_buf`, `ptr::copy_nonoverlapping` wrapper, `MyVec::grow`*

---

## Unsafe sites (file:line list)

*List every `unsafe` block or `unsafe fn` covered by this review, one per line.*

```
src/collections/raw_buf.rs:42   — raw pointer deref after realloc
src/collections/raw_buf.rs:87   — ptr::copy_nonoverlapping in grow()
```

---

## Why unsafe is necessary (vs the safe alternative)

*Explain concisely why the safe Rust alternative (slice indexing, `Vec`, a safe wrapper crate) cannot be used here. If performance is the reason, include a benchmark reference or profiling note.*

> The allocator API requires raw pointer arithmetic; `Vec<u8>` cannot be used because we need a split-ownership layout that the borrow checker cannot express.

---

## Safety invariants (per block: what must hold and why it does here)

*For each unsafe site above, state the invariant(s) that make the operation sound, and a brief argument for why they hold at the call site.*

### `raw_buf.rs:42` — raw pointer deref after realloc

- **Invariant:** pointer is non-null and aligned to `T`.
- **Holds because:** `alloc::alloc` returns a non-null pointer (checked on line 38) aligned to `Layout::new::<T>()`.

### `raw_buf.rs:87` — `ptr::copy_nonoverlapping` in `grow()`

- **Invariant:** source and destination regions do not overlap; both are valid for `len * size_of::<T>()` bytes.
- **Holds because:** `grow()` allocates a fresh buffer before copying; old and new allocations are disjoint by the allocator contract. `len` is tracked by `RawBuf::len` which is only mutated through `&mut self`.

---

## How invariants are upheld (preconditions, types, tests)

*Describe the mechanisms — type-system constraints, precondition checks, module-private fields, `#[doc(hidden)]` constructors, or anything that prevents callers from violating invariants.*

- `RawBuf` fields (`ptr`, `cap`, `len`) are private; only methods in this module can mutate them.
- `RawBuf::new()` is the sole constructor; it zeroes `len` and checks the allocator result.
- `grow()` is `pub(crate)` — external callers cannot trigger the `copy_nonoverlapping` path with an invalid state.
- Precondition `len <= cap` is asserted (`debug_assert!`) at the top of every mutating method.

---

## Verification (miri output, sanitizers, targeted tests)

*Paste or summarize evidence that the code has been exercised under sanitizers. Include the exact command used.*

**Miri**

```
cargo +nightly miri test collections::raw_buf
# Expected: "test result: ok. N passed; 0 failed" with no UB reports
```

*Paste actual Miri output here.*

**AddressSanitizer / MemorySanitizer**

```
RUSTFLAGS="-Z sanitizer=address" cargo +nightly test --target x86_64-unknown-linux-gnu
# Expected: no heap-buffer-overflow or use-after-free reports
```

*Paste sanitizer summary here.*

**Targeted unit tests**

- `test_grow_copies_all_elements` — fills buffer to capacity, triggers grow, checks every element.
- `test_double_free_guard` — drops `RawBuf` twice via `ManuallyDrop`; confirms no double-free under Miri.
- `test_zero_size_type` — constructs `RawBuf<()>` to exercise ZST branch.

---

## Reviewer sign-off (unsafe-auditor) — SAFETY-GATE: pass/fail

*The reviewer must confirm each line before marking pass. Delete any line that does not apply and explain why.*

| Check | Result |
|---|---|
| All unsafe sites listed and justified above | [ ] |
| Invariants are sufficient to rule out UB | [ ] |
| Invariants are enforced by the module boundary | [ ] |
| Miri run clean (no UB, no leaks) | [ ] |
| Sanitizer run clean | [ ] |
| Targeted tests cover boundary conditions | [ ] |

**SAFETY-GATE:** `[ PASS / FAIL ]`

**Auditor:** `<GitHub handle or name>`
**Date:** `YYYY-MM-DD`
**Revision reviewed:** `<git sha or PR #>`

> *Any FAIL or unchecked box must be resolved before this code merges.*
