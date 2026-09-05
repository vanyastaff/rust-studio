---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is the `Cargo.toml` of a published workspace member (shown verbatim in the doc comment) and the top of its `src/lib.rs`. `cargo build` and `cargo publish --dry-run` succeed. Review it before we publish 0.4.2; list findings with line numbers and end with a verdict.

```rust
//! crate: `acme-net` — a PUBLISHED workspace member. Below is its `Cargo.toml`, verbatim, and
//! the top of its `src/lib.rs`. `cargo build` and `cargo publish --dry-run` both succeed. Every
//! defect below is one `rules/cargo-manifest.md` names.
//!
//! ```toml
//! # Cargo.toml — acme-net
//! [package]
//! name = "acme-net"
//! version = "0.4.2"
//! edition = "2024"
//! # NOTE(A-17): fill in metadata before the Phase B release
//!
//! [dependencies]
//! tokio = { version = "1", features = ["full"] }
//! serde = "*"
//! reqwest = "0.12"
//! acme-core = { path = "../acme-core", version = "0.4" }
//! anyhow = "1"
//!
//! [features]
//! default = ["rustls", "native-tls", "metrics", "tracing"]
//! rustls = ["reqwest/rustls-tls"]
//! native-tls = ["reqwest/native-tls"]
//! metrics = []
//! tracing = []
//!
//! [lints.clippy]
//! # the workspace table was too strict for this crate
//! unwrap_used = "allow"
//! ```
//!
//! The workspace root declares `[workspace.lints.clippy] unwrap_used = "deny"` and every other
//! member has `[lints] workspace = true`.

#![deny(warnings)]
#![doc = "Networking primitives for acme."]

pub use acme_core::Endpoint;

/// Connect to `endpoint`.
pub fn connect(endpoint: &Endpoint) -> anyhow::Result<Connection> {
    let _ = endpoint;
    Ok(Connection {})
}

pub struct Connection {}
```
