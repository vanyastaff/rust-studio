---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is the working tree of `tinyconf`, a crate published on crates.io at 1.2.0 with about forty dependents. I changed `parse` to return a `Result` with a typed error instead of `Option`, dropped the `raw` field, bumped the version to 1.3.0 and wrote the changelog entry. `cargo semver-checks` complained but CI is green. Can we tag and publish 1.3.0? If not, tell me exactly how this should ship.

```rust
//! crate: `tinyconf` — PUBLISHED on crates.io, currently 1.2.0, ~40 dependents.
//!
//! This is the working tree for the next release. The author wants `parse` to report *why*
//! parsing failed instead of returning `None`, and to drop the `raw` field nobody should
//! have relied on. The change itself is right. The question is how it is being shipped.
//!
//! Cargo.toml (excerpt):
//!   [package]
//!   name = "tinyconf"
//!   version = "1.3.0"          # was 1.2.0
//!
//! CHANGELOG.md (excerpt, added in this diff):
//!   ## 1.3.0
//!   ### Changed
//!   - `parse` now returns `Result` for better errors.
//!   - Removed the unused `raw` field.
//!
//! `cargo semver-checks check-release`: 3 errors (function_return_type_changed,
//! struct_pub_field_missing, ×1 more) — "ignoring for now, CI is green and the tests pass".

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub values: HashMap<String, String>,
    // pub raw: String,   // removed in this diff — was part of the 1.x public surface
}

/// Kept so that code written against 1.2 keeps compiling.
pub type Cfg = Config;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    Empty,
    BadLine(usize),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::Empty => write!(f, "empty input"),
            ParseError::BadLine(n) => write!(f, "malformed line {n}"),
        }
    }
}
impl std::error::Error for ParseError {}

/// Parse `key = value` lines.
///
/// 1.2.0: `pub fn parse(s: &str) -> Option<Config>`
pub fn parse(s: &str) -> Result<Config, ParseError> {
    if s.trim().is_empty() {
        return Err(ParseError::Empty);
    }
    let mut values = HashMap::new();
    for (i, line) in s.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (k, v) = line.split_once('=').ok_or(ParseError::BadLine(i + 1))?;
        values.insert(k.trim().to_string(), v.trim().to_string());
    }
    Ok(Config { values })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_pairs() {
        let c = parse("a = 1\nb = 2").unwrap();
        assert_eq!(c.values["a"], "1");
        assert_eq!(c.values["b"], "2");
    }

    #[test]
    fn reports_bad_line() {
        assert_eq!(parse("a = 1\noops").unwrap_err(), ParseError::BadLine(2));
    }
}
```
