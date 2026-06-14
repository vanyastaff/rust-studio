# Ground truth — unsafe/missing-safety (agent: unsafe-auditor)

Planted defects in `input.rs`.

| id   | line | type       | severity | defect |
|------|------|------------|----------|--------|
| GT-1 | 10   | SAFETY/UB  | 🔴 | `unsafe { *self.ptr.add(i) }` has **no `// SAFETY:` invariant** and **no bounds check** — `i >= len` is an out-of-bounds read (UB). Needs a bounds check (or a documented caller contract) and a `// SAFETY:` note. |
| GT-2 | 14   | SAFETY-DOC | 🟠 | `pub unsafe fn as_slice<T>` has **no `# Safety` rustdoc** stating the caller's contract; also `ptr as *const T` ignores **alignment** of `T` and assumes `len` is a multiple of `size_of::<T>()`. |
| GT-3 | 19   | SOUNDNESS  | 🔴 | `unsafe impl Send for RawBuf` asserts thread-safety for a type holding a raw `*mut u8` **without justification** — likely unsound; must prove it or remove it. |

Pass = all three caught. The auditor must also note miri as the verification step.
