# Ground truth — wasm/thread-and-time (agent: `wasm-specialist`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"This `wasm-bindgen` crate compiles for the host and its tests pass natively, but it panics in the browser on the first call. Review it for the wasm32 target. List every finding with file:line and severity, then give a verdict."* Every defect is one `rules/wasm.md` names.

| id   | line   | type                           | severity | defect |
|------|--------|--------------------------------|----------|--------|
| GT-1 | 24–26  | `std::thread` ON wasm32        | 🔴 | `thread::spawn` panics (`unsupported`) on `wasm32-unknown-unknown`. Compute inline, or use a Web Worker via `wasm-bindgen`/`web-sys`. |
| GT-2 | 5, 11, 18, 30 | `Instant::now()` ON wasm32 | 🔴 | `std::time::Instant` panics in the browser. `js_sys::Date::now()` / `performance.now()` via `web-sys`. |
| GT-3 | 35     | SECRET HANDED TO JS            | 🔴 | `describe` returns the `api_key` into the page — fully observable in the browser. Never expose secrets across the JS boundary. |
| GT-4 | 35     | `rand` WITHOUT THE JS BACKEND  | 🟠 | `rand::random()` needs `getrandom`'s `wasm_js` backend feature (and the `RUSTFLAGS` cfg on 0.3) for browser entropy; without it the build fails or panics at runtime. Enable it explicitly. |
| GT-5 | 39     | `std::fs` ON wasm32            | 🔴 | No filesystem in the browser; `read_to_string` fails. Fetch via `web-sys`, or accept the config bytes from JS. |
| GT-6 | 26, 39, 43 | `unwrap()` AT THE JS BOUNDARY | 🟠 | Panics cross into JS as an opaque abort. Return `Result<T, JsValue>`, and install `console_error_panic_hook` in debug. |
| GT-7 | 43     | JS INPUT TRUSTED               | 🟠 | `parse` treats a string from JS as valid; every value from JS is untrusted input. Validate, return a typed error to JS. |
| GT-8 | 46–54  | NO SIZE PROFILE / `panic = "abort"` | 🟡 | `opt-level = 3`, no `lto`, `codegen-units`, `strip`, or `panic = "abort"`; no `wasm-opt` step. Size is the dominant wasm concern. |

Pass = GT-1, GT-2, GT-3, GT-5 and at least two of the others, with a `NEEDS WORK` verdict.
