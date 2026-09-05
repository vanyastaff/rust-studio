---
type: llm
weight: 3
---
The response must find the three UB sources (anchored within two lines):
1. Lines 28–29: `.unwrap()` / `.expect()` inside an `extern "C"` fn with `panic = "unwind"` — a panic unwinding into C is UB; return a status code (`catch_unwind` shield or `panic = "abort"`).
2. Lines 8–12, 35–37: `#[repr(u32)] enum Status` receiving an arbitrary C `u32` via `transmute` — an undeclared discriminant is UB; use `#[repr(transparent)] struct Status(u32)` with consts.
3. Line 44: `CString::new(...).unwrap().as_ptr()` inline — the temporary is freed at the end of the statement, so `acme_log` reads a dangling pointer; bind the `CString` to a named local.
Plus 4. Lines 31, 45: `Box::into_raw` / `CString::into_raw` hand ownership to C with no exported free function — leaks, and C `free()` on them is UB.
It should also flag at least one of: `Frame` is not `#[repr(C)]` and contains a `Vec` yet crosses the boundary (lines 15–19); edition 2024 requires `unsafe extern "C"` and `#[unsafe(no_mangle)]` (lines 21, 26, 34, 40, 48); undocumented null/safety contracts on raw pointers (lines 27, 41, 49); `len() as c_int` truncation (line 50).
Full credit: 1–4 plus one other and a NEEDS WORK verdict. Partial: three of 1–4. Fail: two or fewer, or the API is approved.
