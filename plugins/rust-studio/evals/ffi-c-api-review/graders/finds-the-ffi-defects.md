---
type: llm
weight: 3
---
The response must find the three UB sources (anchored within two lines):
1. Lines 28–29: `.unwrap()` / `.expect()` inside an `extern "C"` fn with `panic = "unwind"` — a panic unwinding into C is UB; return a status code (`catch_unwind` shield or `panic = "abort"`).
2. Lines 8–12, 35–37: `#[repr(u32)] enum Status` receiving an arbitrary C `u32` via `transmute` — an undeclared discriminant is UB; use `#[repr(transparent)] struct Status(u32)` with consts.
3. Lines 44–45: `let log_line = CString::new(...).unwrap().as_ptr();` — the `CString` temporary is dropped at the end of that statement, so `acme_log(log_line)` reads freed memory (rustc's `dangling_pointers_from_temporaries`); bind the `CString` itself to a named local.
Plus 4. Lines 31, 46: `Box::into_raw` / `CString::into_raw` hand ownership to C with no exported free function — leaks, and C `free()` on them is UB.
It should also flag at least one of: `*mut Frame` is sound only as an OPAQUE handle (repr(Rust), contains a `Vec`) and nothing states that contract for the header/bindings (lines 15–19, 31); edition 2024 requires `unsafe extern "C"` and `#[unsafe(no_mangle)]` (lines 21, 26, 34, 40, 49); undocumented null/safety contracts on raw pointers (lines 27, 41, 50); `len() as c_int` truncation (line 51).
Full credit: 1–4 plus one other and a NEEDS WORK verdict. Partial: three of 1–4. Fail: two or fewer, or the API is approved.
