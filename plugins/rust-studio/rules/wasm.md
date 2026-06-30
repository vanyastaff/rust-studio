---
name: wasm
paths: "**/wasm/**,**/*wasm*.rs,**/src/lib.rs,**/web/**,**/bindgen/**"
description: Rust wasm32 / wasm-bindgen / browser-target standards
---

# WebAssembly Standards

Applies to code targeting `wasm32-unknown-unknown` / `wasm32-wasi*` and JS interop.
Owned by `wasm-specialist`. Note: the `src/lib.rs` glob is broad — these rules apply
only when the crate actually targets wasm (a `wasm-bindgen` dep or `cdylib` crate type).

## Environment assumptions that break on wasm
- No threads by default on `wasm32-unknown-unknown`: `std::thread`, most of `std::sync`
  blocking primitives, and thread-based parallelism don't work. Use single-threaded or
  the wasm-threads (`atomics`) target deliberately.
- No filesystem / no sockets in the browser: `std::fs` and `std::net` panic or fail.
  Go through web APIs (`web-sys` / `fetch`) instead.
- `std::time::Instant`/`SystemTime` can panic — use `js_sys::Date::now()` /
  `performance.now()` via `web-sys`.
- `getrandom` needs the `js`/`wasm_js` backend feature for browser entropy; without it,
  `rand`/UUID/TLS crates fail to build or panic at runtime. Enable it explicitly.

## Panics & aborts
- A Rust panic across the wasm boundary aborts; install `console_error_panic_hook` in
  debug to surface a real message. Build wasm crates with `panic = "abort"`.

## Binary size (the dominant wasm concern)
- Optimize for size: `opt-level = "z"` (or `"s"`), `lto = true`, `codegen-units = 1`,
  `strip = true` in the release profile; run `wasm-opt -Oz` (via `wasm-pack` or
  `binaryen`) as a post-step.
- Avoid pulling `std::fmt`/panic formatting machinery and heavy deps into the wasm binary;
  measure with `twiggy top` / `cargo bloat`.

## JS interop (wasm-bindgen)
- Keep the `#[wasm_bindgen]` surface small and typed; cross-boundary calls are not free.
  Pass owned data or `&str`/`&[u8]`, not deep borrowed graphs.
- Map `Result<T, E>` to a JS exception with `E: Into<JsValue>`; don't `unwrap` at the
  boundary. Treat all values coming *from* JS as untrusted input (validate before use).
- No secrets or PII in values handed to JS — the browser context is fully observable.
