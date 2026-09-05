---
type: llm
weight: 3
---
A good response measures before guessing: `cargo bloat --release --crates`, `cargo tree`, and the release profile (`opt-level = "z"/"s"`, `lto`, `codegen-units = 1`, `strip`, `panic = "abort"`), names the usual suspects (debug info not stripped, a heavy dependency pulled with default features, duplicated crate versions, `regex`/`serde_json`/`tokio` full features), and proposes a measured before/after. Full credit: a measurement-first plan with the profile knobs and a before/after the user can run. Partial: profile knobs only. Fail: generic advice with no measurement.
