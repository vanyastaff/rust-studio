---
name: architecture
paths: "**/Cargo.toml,**/lib.rs,**/src/lib.rs,**/src/mod.rs,**/src/**/mod.rs,**/src/domain/**/*.rs,**/src/model*.rs,**/src/protocol*.rs,**/src/types.rs"
description: Multi-crate ownership, layering, and boundary standards
---

# Architecture Standards

Applies to crate roots, domain/API modules, module boundaries, and manifests.

## Ownership boundary first
- Before adding a helper, type, trait, error, parser, or constant, ask: which crate owns this
  concept? Put it there, not at the easiest edit site.
- Check sibling crates for an existing primitive before creating a new one.
- The owning crate owns the invariant and the public contract. Consumers should not rebuild
  the same invariant with local validation.

## Struct decomposition for independent borrowing
- The borrow checker sees a struct's fields independently but cannot split a borrow across a
  method call. Split a struct when methods contend on disjoint fields: one `&mut self` method
  otherwise locks every field, blocking concurrent borrows the compiler would accept on
  separate values.
- If the split maps cleanly onto domain concepts, take it. If it does not, that is the signal:
  the contention is design debt — fix the architecture, not just the struct.

## Layering
- Dependencies flow in one direction. Lower-level crates must not reach upward into app,
  transport, UI, or integration crates.
- Re-exporting another crate's type in a public API is a boundary decision, not convenience.
- Avoid "utils" growth. If a helper has domain meaning, give it a domain home; if it has no
  domain meaning, question whether it belongs at all.

## Workspace design
- Workspace-wide dependencies, lints, metadata, feature policy, and lockfile changes belong
  at the workspace level when multiple members are affected.
- A cross-crate change is not done until every affected member compiles and tests against the
  new shape.
- ADRs are revisable in active development. If an ADR forces a workaround, supersede it with
  fresh evidence instead of patching around it.
- Splitting into focused crates buys clear API boundaries, compile parallelism, and selectable
  features — but weigh the costs first: version skew (two incompatible copies of the same
  dependency linked at once), no cross-crate LTO unless you enable it in the release profile,
  and longer clean builds. Take the split when the boundary is real, not by reflex.
- At ~20+ crates, feature unification across members gets expensive; reach for `cargo-hakari`
  to keep the build graph fast.

## SOLID, expressed in Rust
- SRP — one reason to change. Enforce via struct decomposition and crate boundaries: each
  type and each crate owns a single concept.
- OCP — open for extension, closed for modification. Add behavior with `#[non_exhaustive]`
  enums/structs and default trait methods, not by editing closed match arms callers depend on.
- ISP — keep traits small and focused (one capability each, like `Display` or `Iterator`);
  do not bolt unrelated methods onto one god-trait.
- DIP — depend on traits at component boundaries, not on concrete types, so implementations
  can be swapped (real, mock, cached).
- Composition, not inheritance — Rust has none. Compose and delegate; never simulate
  inheritance with `Deref`, and never lean on `Deref` for polymorphism.
- One fact, one place — constants and invariants live in exactly one module and are re-exported
  (`pub use`) where else they are needed. No parallel test-vs-production definitions to drift
  out of sync.
