---
kind: agent
target: rust-build-resolver
allowed_tools: [Read, Edit, Write, Glob, Grep, Bash, Agent]
max_turns: 35
timeout_seconds: 1200
---
The crate `inventory` in the current directory does not build. Get `cargo build`, `cargo clippy --all-targets -- -D warnings`, and `cargo test` green. The intended behavior is what the doc comments and the existing tests describe — do not change behavior, do not weaken or delete tests, and per your brief do not mask an error with `#[allow]`, `unsafe`, `unwrap`, `mem::transmute`, or a `.clone()` added only to appease the borrow checker; restructure ownership or the API shape instead and say why the shape you chose is the right one. Do not commit. Finish with your brief's report: each root error (code + one line), the fix and why, anything touching behavior or API, the final command output proving green, and the verdict line.
