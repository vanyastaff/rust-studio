---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
These `#[macro_export]`ed helpers live in `src/macros.rs` of our util crate and three sibling crates use them. Both tests pass. Review them; list findings with line numbers and end with a verdict.

```rust
//! crate: `acme-util` — `src/macros.rs`, `#[macro_export]`ed helpers used by three sibling
//! crates. Everything compiles and the two unit tests pass. Every defect below is one
//! `rules/macros.md` names, and each is invisible in the source and obvious in `cargo expand`.

/// Clamp `$v` into `[$lo, $hi]`.
#[macro_export]
macro_rules! clamp {
    ($v:expr, $lo:expr, $hi:expr) => {
        if $v < $lo {
            $lo
        } else if $v > $hi {
            $hi
        } else {
            $v
        }
    };
}

/// Log a value at debug level and return it.
#[macro_export]
macro_rules! traced {
    ($e:expr) => {{
        let tmp = $e;
        acme_util::log::debug(&format!("{:?}", tmp));
        tmp
    }};
}

/// Square an expression.
#[macro_export]
macro_rules! square {
    ($e:expr) => {
        $e * $e
    };
}

/// Build a `HashMap` from `k => v` pairs.
#[macro_export]
macro_rules! map {
    ($($k:expr => $v:expr),* $(,)?) => {{
        let mut m = HashMap::new();
        $( m.insert($k, $v); )*
        m
    }};
}

/// Add two numbers.
#[macro_export]
macro_rules! add {
    ($a:expr, $b:expr) => {
        $a + $b
    };
}

pub mod log {
    pub fn debug(s: &str) {
        eprintln!("{s}");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn clamp_works() {
        assert_eq!(clamp!(5, 0, 3), 3);
    }
    #[test]
    fn square_works() {
        assert_eq!(square!(3), 9);
    }
}
```
