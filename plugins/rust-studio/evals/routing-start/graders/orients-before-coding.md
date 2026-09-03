---
type: llm
weight: 2
---
The user asked how to begin a new Rust CLI project in an empty directory. A good response orients before it writes code: it notices there is no `Cargo.toml` yet (or asks/confirms), proposes scaffolding the crate with a concrete layout (binary crate, `clap` for arguments, tests), and asks about or states the goal and acceptance criteria (input size, streaming vs in-memory, ordering guarantees) before implementing. Full credit: orients, proposes a scaffold, and names at least one design question to settle first. Partial: proposes a scaffold with no design questions. Fail: dumps a complete implementation immediately, or answers with generic advice unrelated to Rust.
