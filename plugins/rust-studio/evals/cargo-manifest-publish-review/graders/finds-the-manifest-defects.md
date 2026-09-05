---
type: llm
weight: 3
---
The response must find (line numbers refer to the file as shown, the manifest being the doc-comment block; accept within two lines):
1. Line 15: `serde = "*"` — a wildcard version requirement.
2. Lines 22–23 with 21: `rustls` and `native-tls` are both on by default and select competing TLS backends — mutually exclusive features without a `compile_error!` guard, violating additivity.
3. Lines 27–29: a crate-level `[lints.clippy]` table REPLACES the workspace `[workspace.lints]` table (it does not merge), silently dropping `unwrap_used = "deny"` and every other workspace lint — gate disabling; use `[lints] workspace = true`.
It should also flag at least three of: `tokio` with `features = ["full"]` in a library (line 14; `default-features = false` + explicit features); `default` enabling everything (line 21); `#![deny(warnings)]` in a library (line 35); missing publish metadata and `rust-version` plus a process-ID `NOTE(A-17)` comment in the manifest (lines 7–11); `anyhow::Result` on a published library function (line 41).
Full credit: all three numbered plus three others and a NEEDS WORK verdict blocking the publish. Partial: two numbered plus two. Fail: approves the publish because the dry run is green, or misses the `[lints]` replacement and the wildcard.
