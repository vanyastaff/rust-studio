# Ground truth — api/leaky-surface (agent: api-design-lead)

Planted defects in `input.rs` (a public crate root — every `pub` item is a contract).

| id   | line | type            | severity | defect |
|------|------|-----------------|----------|--------|
| GT-1 | 4    | SEMVER          | 🟠 | `pub enum Status` is not `#[non_exhaustive]` — adding a variant later is a **breaking** change. Mark it `#[non_exhaustive]`. |
| GT-2 | 9    | API LEAK        | 🔴 | `configure` takes `serde_json::Value` in its **public** signature, leaking a dependency type and pinning this crate's semver to `serde_json`. Take a local/owned type or `impl Into<…>`. |
| GT-3 | 14   | API (error type) | 🟠 | `Result<u32, ()>` exposes `()` as the error — opaque, no `Display`/`Error`, useless to callers. Use a typed error (`thiserror`). |

Pass = all three caught. The lead should also note missing rustdoc on the `pub` items.
