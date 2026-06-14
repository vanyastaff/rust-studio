---
name: api
paths: "**/lib.rs,**/src/lib.rs"
description: Public API and semver standards for crate roots
---

# Public API Standards

Applies to crate roots (`lib.rs`) and anything re-exported as `pub`.

## Surface discipline
- Everything `pub` is a contract. Default to `pub(crate)`; promote to `pub`
  deliberately. Re-export the intended surface from the crate root; keep module
  paths from leaking.
- New public enums get `#[non_exhaustive]` unless exhaustive matching is a feature.
- Public structs that may grow fields: `#[non_exhaustive]` or constructor + getters.
- Seal traits you don't want implemented downstream (private supertrait pattern).
- Don't expose third-party types in your public signatures unless that dependency is
  intentionally part of your contract (it pins your semver to theirs).

## Documentation
- Every `pub` item has a rustdoc comment. Crate root has `//!` with a usage example.
- Public functions document: what it does, `# Errors`, `# Panics` (if any),
  `# Safety` (if `unsafe`), and at least one `# Examples` doc-test that compiles.
- Use intra-doc links (`[`Type`]`). `#![warn(missing_docs)]` on the crate.

## Semver
- Adding a variant to a non-`#[non_exhaustive]` enum, a field to a struct, or a
  method to a sealed-less trait is **breaking**. Know before you ship.
- Renames, signature changes, and removing `pub` items are major bumps.
- Run `cargo public-api` / `cargo semver-checks` before release; flag any break.
- `#[must_use]`, `#[deprecated(note = "...", since = "...")]` used deliberately.

## Ergonomics
- Accept `impl Into<...>` / `impl AsRef<...>` at boundaries; return concrete types.
- Provide `From`/`TryFrom` conversions; implement standard traits (`Display`,
  `Error`, `Default`, `Iterator`) where they fit.
