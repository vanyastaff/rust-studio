---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This `wasm-bindgen` crate (`src/lib.rs`, a `cdylib` for `wasm32-unknown-unknown`) compiles for the host and its tests pass natively, but it panics in the browser on the first call. Review it for the wasm32 target; list findings with line numbers and end with a verdict.

```rust
//! crate: `acme-wasm` — `src/lib.rs`, a `cdylib` built for `wasm32-unknown-unknown` with
//! `wasm-bindgen`. It compiles for the host and the unit tests pass natively; in the browser it
//! panics on the first call. Every defect below is one `rules/wasm.md` names.

use std::time::Instant;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Session {
    api_key: String,
    started: Instant,
}

#[wasm_bindgen]
impl Session {
    #[wasm_bindgen(constructor)]
    pub fn new(api_key: String) -> Session {
        Session { api_key, started: Instant::now() }
    }

    /// Hash a document. Heavy, so it runs on a worker thread.
    pub fn digest(&self, doc: &str) -> String {
        let doc = doc.to_string();
        let handle = std::thread::spawn(move || blake3::hash(doc.as_bytes()).to_hex().to_string());
        handle.join().unwrap()
    }

    pub fn elapsed_ms(&self) -> f64 {
        self.started.elapsed().as_millis() as f64
    }

    /// Debug helper exposed to the page.
    pub fn describe(&self) -> JsValue {
        JsValue::from_str(&format!("session key={} nonce={}", self.api_key, rand::random::<u64>()))
    }

    pub fn load_config(&self, path: &str) -> String {
        std::fs::read_to_string(path).unwrap()
    }

    pub fn parse(&self, raw: &str) -> u32 {
        raw.parse::<u32>().unwrap()
    }
}

// Cargo.toml (excerpt):
//   [lib]
//   crate-type = ["cdylib"]
//   [dependencies]
//   wasm-bindgen = "0.2"
//   blake3 = "1"
//   rand = "0.9"
//   [profile.release]
//   opt-level = 3
```
