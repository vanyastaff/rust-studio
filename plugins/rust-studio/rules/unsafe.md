---
name: unsafe
paths: ""
description: Unsafe code standards (injected by the rule-injection hook when you edit code containing unsafe)
---

# Unsafe Code Standards

Injected when an edit introduces or touches `unsafe`. Owned by `unsafe-auditor` /
SAFETY-GATE.

## Every unsafe block earns its keep
- Justify it: there must be a reason the safe equivalent is insufficient (measured perf,
  FFI, intrinsics). "It's easier" is not a reason.
- Keep `unsafe` blocks as small as possible — wrap the single unsafe operation, not a
  whole function body. Expose a **safe** API around it; callers should not need `unsafe`.
- `unsafe` does **not** license UB. It only transfers the burden of proving the absence
  of UB from the compiler to you. If you cannot articulate why the operation is sound,
  it isn't — do not write it.

## SAFETY invariants
- Every `unsafe` block has a `// SAFETY:` comment directly above it stating the
  invariant that makes it sound and why it holds here (alignment, non-null, valid for
  reads/writes of N bytes, no aliasing, lifetime, initialization). No exceptions.
- Every `unsafe fn` documents its `# Safety` contract in rustdoc as a bulleted list of
  preconditions the caller MUST uphold (valid-for-reads/writes of N bytes, alignment,
  no concurrent mutation, lifetime). Prefer safe fns with internal `unsafe` over public
  `unsafe fn`.
- `unsafe_op_in_unsafe_fn` is default-**deny** in Edition 2024: inside an `unsafe fn`,
  each unsafe op still needs its own `unsafe { … }` wrapper with its own SAFETY comment.
  Never disable the lint.
- Encapsulate raw operations behind a small module (1–3 types, 10–20 methods) whose
  every export is safe; outer code never sees `unsafe`.

## Undefined behavior the auditor must rule out
UB is forbidden everywhere, including inside `unsafe` blocks. The reviewer proves each of
these cannot happen on any reachable path:
- **Data races** — concurrent unsynchronized accesses to the same bytes where at least
  one is a write.
- **Dereferencing a dangling or misaligned pointer** — any load or store through it. A
  pointer is dangling when not all `size_of_val` bytes lie inside one live allocation.
- **Out-of-bounds place projection** — field access, index, or tuple index reached
  through an invalid pointer.
- **Aliasing violations** — `&T` requires the pointee is never mutated through it except
  via `UnsafeCell`; `&mut T` requires it is the *only* live reference (shared or mutable)
  to those bytes. Never forge a `&mut` from a `&` (cast `&i32 → *const → *mut` then write
  is UB) — reach for `UnsafeCell` when you need shared mutability.
- **Mutating immutable bytes** — bytes behind an immutable binding, reachable through a
  non-`UnsafeCell` shared reference, or const-promoted, must not be written.
- **Wrong-ABI call or unwinding across a frame that forbids it** (e.g. panicking out of an
  `extern "C"` fn) — wrap FFI entry points so panics cannot escape.
- **Producing an invalid value** (see below).
- Also: bad inline asm, executing a `target_feature` the CPU lacks, `longjmp`-ing past
  Rust frames, and any intrinsic misuse.

## Invalid values — UB even in private fields
Constructing any of these is instant UB, regardless of whether the bytes are ever read:
- `bool` outside `{0, 1}`.
- A null `fn` pointer.
- A `char` that is a surrogate (`0xD800..=0xDFFF`) or greater than `char::MAX`.
- Reading an **uninitialized** integer, float, raw pointer, `bool`, or `char` (uninit is
  only allowed inside `union` fields and padding).
- An `enum` holding a discriminant that was never declared.
- `NonNull<T>` or any `NonZero<_>` holding `0`.
- A `&T` / `&mut T` / `Box<T>` that is null, misaligned, dangling, or points at an invalid
  value.
- A wide pointer whose metadata is wrong (e.g. a `dyn Trait` vtable that doesn't match the
  actual type), or slice/str metadata that pushes total size past `isize::MAX`.

## Pointers, layout, and `repr`
- `&raw const`/`&raw mut` on a misaligned (or uninit, or aliased) place is **OK** — it
  yields a raw pointer and creates no reference. Taking `&`/`&mut` of that same place is
  **UB** (it produces an invalid reference). Always prefer `&raw` to "build a reference
  just to get a pointer"; it replaces `addr_of!`/`addr_of_mut!`.
- `#[repr(packed)]` fields may be unaligned: never `&packed.field`. Access them via
  `&raw const/mut` + `read_unaligned`/`write_unaligned`, or copy the field out by value.
- `#[repr(u8/u16/u32/…)]` on a **fieldless** enum lets it hold only its declared
  discriminants — any other bit pattern is UB. To accept arbitrary integers from C, do
  **not** use a Rust `enum`; use `#[repr(transparent)] struct Foo(u32)` with associated
  `const` values.
- Default `repr(Rust)` layout is unspecified (fields may reorder, padding inserted, enum
  discriminants niche-packed). Never assume field order or transmutability under it. Use
  `#[repr(C)]` for FFI/transmute layout and `#[repr(transparent)]` for newtypes that must
  share ABI with their single non-ZST field.
- `Option<&T>` has the same layout and ABI as `*const T` via the null niche (likewise
  `Option<NonNull<T>>`, `Option<NonZero<_>>`, `Option<Box<T>>`, optional `fn` pointers).
  You MAY rely on `Option<&T>` == `*const T` at the FFI boundary.

## Uninitialized memory
- `MaybeUninit<T>` is the **only** legal holder of uninitialized data for a non-`union`
  type. Always `write` (or otherwise fully initialize) before `assume_init`; calling
  `assume_init` on untouched `MaybeUninit` is UB.
- Never use `mem::uninitialized()` (removed) or `mem::zeroed()` for a type whose all-zero
  bit pattern is invalid — `NonZero`, `&T`, `Box<T>`, `bool`, `char`, etc.
- On recent std, prefer the `MaybeUninit` slice helpers (`write_copy_of_slice`,
  `assume_init_ref`/`assume_init_mut`, `assume_init_drop`) to centralize the SAFETY
  reasoning instead of hand-rolling transmutes.

## Marker traits, Send/Sync, and Pin
- A trait that imposes safety obligations on its implementors is an `unsafe trait`, and
  every implementation is an `unsafe impl` that proves the obligation. Callers of its
  methods do not need `unsafe`.
- A manual `unsafe impl Send`/`unsafe impl Sync` must *prove* the thread-safety claim in
  its SAFETY comment. To opt **out** instead, hold a `PhantomData` field
  (`PhantomData<*const ()>` for `!Send + !Sync`, `PhantomData<Cell<()>>` for `!Sync`).
- Hand-written `Future`s and intrusive/self-referential structures opt out of `Unpin`
  with a `PhantomPinned` field, and use `pin-project`/`pin-project-lite` to safely
  project fields of a pinned struct — never move out of `Pin<&mut Self>` by hand.

## The invariants to check
- **Aliasing / provenance**: no `&mut` aliasing; don't fabricate references to invalid
  or aliased data; respect Stacked/Tree Borrows (verify with miri).
- **Initialization**: no reading uninitialized memory; use `MaybeUninit` correctly.
- **Bounds & layout**: pointer arithmetic in-bounds; correct `repr`, size, alignment;
  `&raw` (not `&`) for misaligned/uninit/packed places.
- **Validity**: every constructed value is valid for its type (no out-of-range `bool`,
  null `NonNull`, surrogate `char`, undeclared enum discriminant, dangling reference).
- **Lifetimes**: transmuted/extended lifetimes are actually valid; no dangling. A custom
  owning smart pointer over `NonNull<T>` still needs `PhantomData<T>` for drop-check.
- **Send/Sync**: manual `unsafe impl Send/Sync` proves the thread-safety claim; opt-out
  is a `PhantomData` field, not a missing impl by accident.
- **FFI**: ABI matches; ownership across the boundary is clear; no unwinding across the
  boundary (`extern "C"` must not let a panic escape).

## Verification
- Run `cargo +nightly miri test` over **all** code exercising `unsafe` (wherever miri can
  run it) — miri is mandatory for any unsafe, not optional.
- Run `loom` model checks for lock-free code, hand-rolled atomics, or custom
  synchronization. Consider `cargo careful`, ASan/TSan for FFI/concurrency.
- Add tests that actually hit the unsafe path.
- Anything non-trivial gets a `safety-review.md` (see templates) and `unsafe-auditor`
  sign-off before SAFETY-GATE passes.
