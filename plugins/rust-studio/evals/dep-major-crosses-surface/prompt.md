---
max_turns: 16
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
Review the semver impact of this release of `leaf` before I publish it. The crate's own source is unchanged; the manifest moved `http` from `0.2` to `1` and the version from `0.1.0` to `0.1.1`. Every check in CI is green, including `cargo semver-checks`. Is the version bump right? Report findings with line numbers and severity, and end with a verdict.

```rust
// crates/leaf/src/lib.rs — unchanged in this release. Only the manifest moved.
//
// Cargo.toml diff for leaf 0.1.0 → 0.1.1:
//     -version = "0.1.0"          +version = "0.1.1"
//     -http    = "0.2"            +http    = "1"
//
// Release evidence attached to the PR:
//     cargo build --workspace                  → clean
//     cargo nextest run                        → 27 passed, 0 failed
//     cargo clippy --all-targets -- -D warnings → clean
//     cargo semver-checks check-release        → 196 checks: 196 pass, 58 skip
//                                                Summary: no semver update required

/// Normalize a request target.
pub fn normalize(u: http::Uri) -> String {
    u.path().to_string()
}

/// Re-exported for callers that build their own targets.
pub use http::Uri;

/// Split a target into (path, query).
pub fn split(u: &http::Uri) -> (&str, Option<&str>) {
    (u.path(), u.query())
}
```
