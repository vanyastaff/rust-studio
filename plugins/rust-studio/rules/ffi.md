---
name: ffi
paths: "**/ffi*.rs,**/src/ffi/**,**/bindings*.rs,**/*-sys/src/**,**/*_sys/src/**,**/src/c_api*.rs"
description: FFI / C-interop layout, ownership, and ABI-safety standards
---

# FFI / C-Interop Standards

Applies to FFI shims, `-sys` crates, generated bindings, and any `extern` boundary.
Owned by `ffi-specialist` / `unsafe-auditor`; the unsafe surface also answers to
`unsafe.md` and SAFETY-GATE.

## Layout & ABI
- `#[repr(C)]` on every struct that crosses the boundary: field order = declaration order,
  alignment = max field alignment, size rounded up to alignment. Never assume `repr(Rust)`
  layout (the compiler reorders fields and packs niches).
- `#[repr(transparent)]` on a newtype passed where the inner type is expected (same layout +
  ABI as the single non-zero-sized field). Don't wrap generic ZSTs you don't control.
- `#[repr(packed)]` fields may be unaligned: never take `&packed.field`; use `&raw const` /
  `&raw mut` + `read_unaligned` / `write_unaligned`, or copy out by value.
- A C enum that may carry arbitrary integers is `#[repr(transparent)] struct Foo(u32)` + `const`
  values, **not** a Rust `enum` — an undeclared discriminant is UB.
- `Option<&T>` == `*const T` (null niche) is guaranteed at the boundary; rely on it instead of
  passing both a pointer and a "present" flag.

## Unwinding
- A panic unwinding across `extern "C"` is UB. Compile FFI-exposed crates with
  `panic = "abort"`, or wrap the body in `catch_unwind` and convert to an error code.
- No `unwrap`/`expect`/indexing on the exported path that a caller can trigger — turn every
  failure into a return code.

## Strings
- Accept `*const c_char` via `CStr::from_ptr(...).to_str()` (document non-null, NUL-terminated,
  valid-for-the-call, immutable in the `# Safety` section). Never hand-roll `strlen` +
  `copy_nonoverlapping` — a classic UB source.
- Pass to C by binding the `CString` to a **named local** first, then `.as_ptr()`. Inline
  `seterr(CString::new(s)?.as_ptr())` dangles immediately; keep the `CString` alive across the
  call.

## Errors
- Model failure as a flat `#[repr(i32)]` return code, or a return code + out-parameter pointer
  (`*mut *mut c_char`, `*mut Datum`). Document each code.
- Never return an owned Rust `String`/`Vec` by value to C. Transfer ownership through the
  caller's allocator and pair every alloc with an explicit `*_free` function.

## Object API
- Expose opaque owned handles via `Box::into_raw` / `Box::from_raw` (`thing_new` / `thing_free`).
  Provide free C functions over the handle — not trait objects.
- Transactional / caller-owned types are transparent `#[repr(C)]`; encapsulated types stay
  owned by Rust and managed through the opaque pointer.
- Consolidate a multi-type Rust API into one wrapper. Store iterator **state** (an index) and
  reconstruct the iterator per call — never store a live borrowed iterator with `'self`
  transmuted to `'static` (UB). Embed cursor state in the parent (POSIX DBM pattern).

## Discipline
- Every `unsafe` block carries a `// SAFETY:` comment stating the invariant relied on. Every
  `pub unsafe extern` fn documents its `# Safety` contract: each bullet a precondition the
  caller must uphold.
- Generate or check bindings with `bindgen` / `cbindgen`; don't transcribe signatures by hand.
- Keep the unsafe surface in a small module behind a safe Rust API so outer code never sees
  `unsafe`. Anything non-trivial gets `unsafe-auditor` sign-off before SAFETY-GATE passes.
