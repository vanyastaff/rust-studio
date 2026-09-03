---
type: llm
weight: 3
---
The response audits the unsafe code and must report all three of these, anchored to (or within two lines of) the stated line:
1. Line 10: `unsafe { *self.ptr.add(i) }` has no `// SAFETY:` comment and no bounds check, so `i >= len` is an out-of-bounds read (undefined behavior); needs a bounds check or a documented caller contract plus the SAFETY note.
2. Line 14: `pub unsafe fn as_slice<T>` has no `# Safety` rustdoc section; `ptr as *const T` ignores the alignment of `T` and assumes `len` is a multiple of `size_of::<T>()`.
3. Line 19: `unsafe impl Send for RawBuf` asserts thread-safety for a raw `*mut u8` holder with no justification (likely unsound; must be proven or removed).
The response should also name Miri (`cargo +nightly miri test`) as the verification step. Full credit: all three plus Miri. Partial: all three without Miri, or two with Miri. Fail: fewer than two.
