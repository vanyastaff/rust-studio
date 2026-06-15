# Ground truth — api/non-exhaustive-and-fundamental (verdict: RESHAPE NEEDED)

> Mapped agent is `api-design-lead` (a pre-code lead), whose reject token is
> **RESHAPE NEEDED**. `REDO-TO-BAR` is the `rust-reviewer` equivalent — accept either as
> "rejected the shape".

A published-crate (`nebula-store` 1.x) public surface. Every `pub` item is a semver
contract. The shape pins this crate's future in four ways that compile today but force a
breaking release later — fix the shape before it ships, not after.

| id   | line | type            | severity | defect |
|------|------|-----------------|----------|--------|
| GT-1 | 9    | SEMVER (enum)   | 🟠 | `pub enum ApiError` has no `#[non_exhaustive]`, yet new failure modes (network, auth, quota) are clearly coming. Adding a variant later is a **breaking** change, and callers can write exhaustive `match` with no `_` arm. Mark it `#[non_exhaustive]` now. |
| GT-2 | 17   | MUST-USE        | 🟠 | `Store::begin` returns a `Transaction` guard that **rolls back on drop**, but the type lacks `#[must_use]`. `let _ = store.begin();` silently discards the work with no warning. Add `#[must_use = "a Transaction rolls back unless committed"]` to the type (and on `begin`). |
| GT-3 | 40   | FUNDAMENTAL     | 🔴 | `impl<T: Storable> Storable for Box<T>` is a blanket impl on a **fundamental** type (`Box`). Once published it can never be removed without a major bump, it forecloses every downstream `impl Storable for Box<MyType>`, and it commits the trait's coherence forever. Don't ship a blanket impl on a fundamental type in 1.x unless it is truly load-bearing; offer it as an opt-in or omit it. |
| GT-4 | 61   | DEP-LEAK (semver) | 🟠 | `Store::snapshot(&self) -> serde_json::Value` returns a third-party type directly, pinning this crate's public semver to `serde_json`: a major bump there forces a major bump here. Return an owned local type, or gate the JSON shape behind a feature and a sealed wrapper. |

Pass = the agent returns a reject verdict (**RESHAPE NEEDED**, or REDO-TO-BAR from a
reviewer) and flags the semver hazards: `#[non_exhaustive]` on the growable error enum,
`#[must_use]` on the guard handle, the fundamental-`Box` blanket impl as a forever-locked /
downstream-constraining decision, and the leaked `serde_json::Value` return pinning this
crate to a dependency's semver. ACCEPTABLE is a fail — "it compiles and returns the right
data" is not the bar for a published surface.
