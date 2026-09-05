---
type: llm
weight: 3
---
A good response drives an API design session rather than dumping code: it asks or states the use cases and the design decisions (owned vs borrowed input, error type shape — a typed `thiserror` enum, `#[non_exhaustive]` on it —, builder vs constructor, `FromStr`/`TryFrom` integrations, what is `pub`), applies the Rust API guidelines, and mentions semver hygiene for a published crate (`#[non_exhaustive]`, sealed traits where growth is expected, `cargo semver-checks`/`public-api` before release). Full credit: a design-session shape with the decisions named (or the use-case questions that decide them) and the semver hygiene stated. Partial: a reasonable API sketch with no semver hygiene. Fail: a code dump with no design decisions.
