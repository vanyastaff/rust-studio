---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
Review this Rust library code before I merge it. It lives at `crates/config/src/parse.rs` and callers depend on it not panicking. List every real problem with its line number and a severity, say how to fix each, and end with a merge verdict.

```rust
// crates/config/src/parse.rs — library code (callers depend on it not panicking)
use std::collections::HashMap;

/// Parse a `key=value` config line into `out`.
pub fn parse_line(line: &str, out: &mut HashMap<String, String>) {
    let idx = line.find('=').unwrap();
    let key = &line[..idx];
    let value = &line[idx + 1..];
    out.insert(key.to_string(), value.to_string());
}

/// Map a Unicode code point into a legacy single-byte table slot.
pub fn to_byte(code: u32) -> u8 {
    code as u8
}

/// Return the `n`-th comma-separated field of `line`.
pub fn nth_field(line: &str, n: usize) -> &str {
    line.split(',').collect::<Vec<_>>()[n]
}
```
