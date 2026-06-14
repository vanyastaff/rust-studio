---
name: unsafe
paths: ""
description: Unsafe code standards (injected by the unsafe-guard hook when unsafe is introduced)
---

# Unsafe Code Standards

Injected when an edit introduces or touches `unsafe`. Owned by `unsafe-auditor` /
SAFETY-GATE.

## Every unsafe block earns its keep
- Justify it: there must be a reason the safe equivalent is insufficient (measured perf,
  FFI, intrinsics). "It's easier" is not a reason.
- Keep `unsafe` blocks as small as possible — wrap the single unsafe operation, not a
  whole function body. Expose a **safe** API around it; callers should not need `unsafe`.

## SAFETY invariants
- Every `unsafe` block has a `// SAFETY:` comment directly above it stating the
  invariant that makes it sound and why it holds here (alignment, non-null, valid for
  reads/writes of N bytes, no aliasing, lifetime, initialization).
- Every `unsafe fn` documents its `# Safety` contract in rustdoc: what the caller must
  guarantee. Prefer safe fns with internal `unsafe` over public `unsafe fn`.

## The invariants to check
- **Aliasing / provenance**: no `&mut` aliasing; don't fabricate references to invalid
  or aliased data; respect Stacked/Tree Borrows (verify with miri).
- **Initialization**: no reading uninitialized memory; use `MaybeUninit` correctly.
- **Bounds & layout**: pointer arithmetic in-bounds; correct `repr`, size, alignment.
- **Lifetimes**: transmuted/extended lifetimes are actually valid; no dangling.
- **Send/Sync**: manual `unsafe impl Send/Sync` proves the thread-safety claim.
- **FFI**: ABI matches; ownership across the boundary is clear; no unwinding across FFI.

## Verification
- Run `cargo +nightly miri test` over code exercising the `unsafe` (where it can run).
- Consider `cargo careful`, ASan/TSan for FFI/concurrency. Add tests that hit the path.
- Anything non-trivial gets a `safety-review.md` (see templates) and `unsafe-auditor`
  sign-off before SAFETY-GATE passes.
