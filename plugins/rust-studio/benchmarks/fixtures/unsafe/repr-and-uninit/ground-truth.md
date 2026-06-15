# Ground truth — unsafe/repr-and-uninit (agent: unsafe-auditor)

Planted defects in `input.rs`. The auditor should catch each.

| id   | line | type      | severity | defect |
|------|------|-----------|----------|--------|
| GT-1 | 16   | SAFETY/UB | 🔴 | `let r: &u32 = &p.field;` forms a **reference into a `#[repr(packed)]` field** — the field is under-aligned, so even creating the `&u32` is instant UB. Take `&raw const p.field` and `read_unaligned`, or copy the field out by value (`let v = p.field;`). |
| GT-2 | 30   | SAFETY/UB | 🔴 | `mem::transmute::<u8, Status>(byte)` builds a `#[repr(u8)] enum` from an **FFI byte that may not be a declared discriminant** — any value other than `0`/`1` is an invalid `Status` (UB). Model it as `#[repr(transparent)] struct Status(u8)` with named consts, or validate the byte and return an error for unknown values. |
| GT-3 | 35   | SAFETY/UB | 🔴 | `MaybeUninit::<i32>::uninit().assume_init()` (read on line 36) **reads the value before any write** — `assume_init` on uninitialized memory is UB. Write the slot first, then `assume_init`. |
| GT-4 | 46   | SOUNDNESS | 🔴 | `unsafe impl Send for Device` asserts cross-thread safety for a type holding a raw `*mut u8` **with no justification** — likely unsound. Prove the pointer is safe to send (and write a `// SAFETY:` note) or drop the impl. |

Pass = all caught; auditor must name miri as the verification step.
