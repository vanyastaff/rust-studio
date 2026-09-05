# Ground truth — ffi/unwind-and-dangling (agent: `ffi-specialist`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review the exported C API in `src/ffi.rs` before the Python and Go binding teams build on it. Edition 2024, default profile. List every finding with file:line and severity, then give a verdict."* It links and the smoke test passes; every defect is one `rules/ffi.md` / `rules/unsafe.md` names.

| id   | line   | type                        | severity | defect |
|------|--------|-----------------------------|----------|--------|
| GT-1 | 28–29  | UNWIND ACROSS `extern "C"`  | 🔴 | `.unwrap()` on invalid UTF-8 and `.expect()` on the decoder — both panic in an `extern "C"` fn with `panic = "unwind"`: UB. Return a status code (`catch_unwind` shield or `panic = "abort"`), never panic on caller input. |
| GT-2 | 8–12, 35–37 | RUST `enum` AS A C ENUM | 🔴 | `#[repr(u32)] enum Status` receives an arbitrary C `u32` via `transmute` — any undeclared discriminant is instant UB. `#[repr(transparent)] struct Status(u32)` with associated `const`s. |
| GT-3 | 44–45  | DANGLING `CString::as_ptr()` | 🔴 | `let log_line = CString::new(...).unwrap().as_ptr();` — the `CString` temporary is dropped at the end of that statement, so `acme_log(log_line)` on the next line reads freed memory (rustc's `dangling_pointers_from_temporaries` fires here). Bind the `CString` itself to a named local and call `.as_ptr()` on it in the call. |
| GT-4 | 15–19, 31 | NON-`repr(C)` STRUCT ACROSS THE BOUNDARY | 🟠 | `Frame` is `repr(Rust)` (and contains a `Vec`) yet its pointer is handed to C and dereferenced by field name on the C side of the header. Either opaque handle only (never touch fields from C) with a documented layout-free contract, or a `#[repr(C)]` view struct without `Vec`. |
| GT-5 | 31, 46 | OWNERSHIP WITHOUT A DESTRUCTOR | 🟠 | `Box::into_raw` (frame) and `CString::into_raw` (string) hand ownership to C with no exported `acme_frame_free` / `acme_string_free` — every call leaks, and C `free()` on them is UB. Pair every `into_raw` with an exported `from_raw` destructor. |
| GT-6 | 21–24, 26, 34, 40, 49 | EDITION 2024 SYNTAX | 🟠 | `extern "C" {}` must be `unsafe extern "C" {}` and `#[no_mangle]` must be `#[unsafe(no_mangle)]` in edition 2024 — these are hard errors, so either the crate is not on 2024 as claimed or this does not build. |
| GT-7 | 27, 30, 41–42, 50–51 | UNDOCUMENTED NULL / SAFETY CONTRACTS | 🟡 | Raw pointer parameters are dereferenced with no `# Safety` section and no null check; `out_len` written blindly. Document the contract per pointer and/or use `Option<NonNull<T>>` / `Option<&mut usize>`. |
| GT-8 | 51     | TRUNCATING CAST ON THE BOUNDARY | 🟡 | `data.len() as c_int` truncates above `i32::MAX`. `try_into` with a status code, or a `size_t` return. |

Pass = GT-1, GT-2, GT-3 (the three UB sources) plus GT-5 and at least one more, with a
`NEEDS WORK` verdict withholding the SAFETY-GATE sign-off.
