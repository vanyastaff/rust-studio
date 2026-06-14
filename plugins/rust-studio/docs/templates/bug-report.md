<!-- rust-studio template — copy this file into your project and fill in every section before filing a bug -->

# Bug: <summary>

*One sentence: what breaks and when. E.g. "Calling `Client::connect` with a TLS feature enabled panics at startup on Windows."*

## Environment

| Field | Value |
|---|---|
| Crate name & version | *e.g. `my-crate 0.4.2`* |
| `rustc -V` | *e.g. `rustc 1.78.0 (9b00956e5 2024-04-29)`* |
| OS & version | *e.g. Windows 11 22H2, Ubuntu 24.04, macOS 14.4* |
| Target triple | *e.g. `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`* |
| Enabled features | *e.g. `default-features = false, features = ["tls", "async-std"]`* |
| Toolchain channel | *e.g. `stable`, `nightly-2024-05-01`* |

## Steps to reproduce

*Numbered, copy-pasteable steps. Start from a fresh checkout or `cargo new` where possible.*

1.
2.
3.

## Expected behavior

*What should happen. Be specific — describe the value, output, or side-effect you expected.*

## Actual behavior

*What actually happens. Include the exact error message, panic output, or wrong value.*

## Minimal reproduction

*The smallest self-contained example that triggers the bug. Prefer a single `main.rs` snippet; if a full project is needed, paste `Cargo.toml` and `src/main.rs` or link a public repo/gist.*

```toml
# Cargo.toml
[package]
name = "repro"
version = "0.1.0"
edition = "2021"

[dependencies]
# paste relevant dependency lines here
```

```rust
// src/main.rs
fn main() {
    // minimal code that reproduces the bug
}
```

## Logs / backtrace

*Run with `RUST_BACKTRACE=1 cargo run` (or `RUST_BACKTRACE=full` for full frames). Paste the relevant output below.*

```
RUST_BACKTRACE=1 cargo run 2>&1
<paste output here>
```

## Suspected area

*Optional — file path, module, or trait where you think the bug lives. E.g. `src/connection/pool.rs`, `impl AsyncRead for MyReader`. Skip if unknown.*
