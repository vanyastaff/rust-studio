# Ground truth — cargo-manifest/loose-and-unified (agent: `dependency-manager`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review this crate's `Cargo.toml` and the top of `lib.rs` before we publish 0.4.2. List every finding with the line number and severity, then give a verdict."* `cargo build` and `cargo publish --dry-run` succeed; every defect is one `rules/cargo-manifest.md` names. Line numbers refer to the file as shown (the manifest is the `//!` block).

| id   | line   | type                          | severity | defect |
|------|--------|-------------------------------|----------|--------|
| GT-1 | 15     | WILDCARD VERSION              | 🔴 | `serde = "*"` — any future serde, including a hijacked release, resolves; crates.io rejects wildcards at publish anyway. Pin with caret (`"1"`). |
| GT-2 | 14     | KITCHEN-SINK FEATURES         | 🟠 | `tokio` with `features = ["full"]` in a library pulls every runtime component into every consumer. `default-features = false` + the features actually used. |
| GT-3 | 21     | EVERYTHING IN `default`       | 🟠 | `default = ["rustls", "native-tls", "metrics", "tracing"]` — keep `default` minimal and let users opt in. |
| GT-4 | 22–23  | MUTUALLY EXCLUSIVE FEATURES WITHOUT A GUARD | 🔴 | `rustls` and `native-tls` are both on by default and both enable a TLS backend in `reqwest` — features must be additive; if they genuinely exclude each other, add a `compile_error!` guard, otherwise make one the default. |
| GT-5 | 27–29  | CRATE `[lints]` TABLE REPLACES THE WORKSPACE TABLE | 🔴 | A crate-level `[lints.clippy]` **replaces** (does not merge with) `[workspace.lints]`, so this member silently drops the workspace's `unwrap_used = "deny"` and every other workspace lint — Gate disabling. Use `[lints] workspace = true` and, if an exception is truly needed, an in-source `#[allow]` with a justification. |
| GT-6 | 35     | `#![deny(warnings)]` IN A LIBRARY | 🟠 | A newly stabilized lint breaks every consumer's build. Set levels in the manifest and gate with `RUSTFLAGS="-D warnings"` in CI. |
| GT-7 | 7–11   | MISSING PUBLISH METADATA + MSRV | 🟠 | No `description`, `license`, `repository`, `readme`, `keywords`, `categories`, or `rust-version` for a published crate — and the comment defers them to a "Phase B" with a plan ID (`NOTE(A-17)`), which is process history the hygiene rule forbids in a manifest. |
| GT-8 | 41     | `anyhow` ON A LIBRARY SURFACE | 🟡 | `anyhow::Result` in a published `pub fn` — binaries only; a typed error here (`error-model.md`). |

Pass = GT-1, GT-4, GT-5 and at least three of the others, with a `NEEDS WORK` verdict blocking the
publish. Passing the manifest because `publish --dry-run` is green is the fail.
