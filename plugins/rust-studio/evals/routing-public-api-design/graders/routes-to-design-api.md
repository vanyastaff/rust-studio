---
type: llm
weight: 3
---
A good response drives an API design session rather than dumping code: it asks or states the use cases and the design decisions (owned vs borrowed input, error type shape — a typed `thiserror` enum, `#[non_exhaustive]` on it —, builder vs constructor, `FromStr`/`TryFrom` integrations, what is `pub`), applies the Rust API guidelines, and mentions semver hygiene for a published crate (`#[non_exhaustive]`, sealed traits where growth is expected, `cargo semver-checks`/`public-api` before release). In the studio it should route to `/design-api` or `/team-api`. Full credit: a design-session shape with the decisions named and the studio skill used or named. Partial: a reasonable API sketch with no semver hygiene. Fail: a code dump with no design decisions.
