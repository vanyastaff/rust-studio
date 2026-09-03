---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is the public crate root of `widget` (`crates/widget/src/lib.rs`) and we are about to tag 1.0. Review the public API surface before the release and end with a verdict.

```rust
// crates/widget/src/lib.rs — the public crate root
use serde_json::Value;

pub enum Status {
    Ok,
    Retrying,
}

pub fn configure(raw: Value) -> Status {
    let _ = raw;
    Status::Ok
}

pub fn parse_id(input: &str) -> Result<u32, ()> {
    input.parse().map_err(|_| ())
}
```
