---
name: architecture
paths: "**/Cargo.toml,**/lib.rs,**/src/*.rs,**/src/**/mod.rs,**/src/domain/**/*.rs"
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
- A type that *describes* something (a definition, spec, schema, config) and a type that tracks
  the *runtime state* of executing it (a progress / lifecycle state machine) are different
  concepts with different owners. Keep run-time state out of the crate that only defines the
  shape — a runtime state machine sitting in, or re-exported from, the definition/spec crate is
  boundary erosion even when it compiles.

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

## Crate-extraction tells — when a module has outgrown its home
Workspace design above says what a split COSTS. These say when to pay it. They are **reading
tells, not lints** — no clippy rule fires on any of them, and cargo will happily compile a
workspace whose boundaries stopped matching the code years ago, which is exactly why they need
naming instead of a linter that will never arrive. Each one is something you can point at in the
tree. **Size is not a tell**: a 2000-line module with one consumer and one dependency is a module.

- **It is the recompile hotspot of a crate that churns for other reasons.** The crate, not the
  module, is Rust's compilation unit — any edit anywhere in the crate rebuilds all of it and
  everything downstream. A large, stable module sitting beside a churning one is recompiled for
  free on every unrelated edit. Extraction makes it a separate compilation unit that stops
  rebuilding and can build in parallel with its former host. Confirm with `cargo build --timings`
  before claiming this one.
- **The orphan rule is being worked around.** Coherence permits `impl Trait for Type` only when
  the trait or the type is local, so a crate owning neither wraps one in a newtype to get the
  impl. A wrapper with no domain meaning — same fields, methods that only delegate, named
  `FooWrapper` / `MyFoo` — is not a type, it is a boundary in the wrong place. Moving the type to
  a crate both sides depend on makes the impl legal at the source and deletes the wrapper. Check
  first whether such a crate already exists: the fix is often to move the type DOWN into it
  rather than to mint a new one.
- **It has its own dependency set that the rest of the crate never uses.** Dependencies are per
  package, not per module, so every consumer compiles, links, audits, and inherits the MSRV of
  deps only this module touches. Extraction moves that cost onto the consumers that asked for it.
  Try an optional dependency behind a feature first — cheaper, until the next tell fires.
- **A feature flag exists only to avoid compiling it.** That is a crate boundary drawn in
  `Cargo.toml` instead of the filesystem, and it does not hold: Cargo unifies features across the
  graph, so once any member enables it, it is on for every build of that crate. Extraction turns
  "feature off" into "not a dependency" — a state a sibling cannot silently undo — and deletes the
  `#[cfg(feature = "...")]` scaffolding. Check with `cargo tree -e features`.
- **It sets a per-package floor for everyone else.** `rust-version`, `edition`, and in practice
  target support (`no_std`, `wasm32`, a cross target) are properties of the package. One module
  that needs a newer compiler, or that is the single reason `cargo check --target ...` fails,
  holds the whole crate's floor hostage. Two crates can carry two floors; one crate cannot.
- **Removing it would break a cycle Cargo already forbids.** Modules within a crate may refer to
  each other freely; crates may not — Cargo rejects a dependency cycle outright. When two members
  both need this module it lands in whichever was convenient, and the other reaches upward,
  duplicates it, or takes a `dev-dependencies` back-edge. A third crate is not one option here,
  it is the only legal shape.
- **A sibling already consumes it through a narrow, stable door.** Other members import
  `that_crate::this_module::{A, B}` and nothing else in the crate, and have for a while. The
  boundary already exists and is already load-bearing — it is just undeclared, so nothing stops
  the next edit from widening it. Extraction hands the door to the compiler and makes the rest of
  the crate genuinely private.
- **A sibling is copying it rather than depending on the crate.** Depending on a crate means
  taking its whole dependency set, features, compile time, and public surface; when that price is
  too high, copying is cheaper. The duplicate is the price signal, and it breaks "one fact, one
  place" — two owners of one invariant, drifting apart. Confirm it is really a copy: a
  near-identical type that has already diverged in MEANING is two concepts, not one duplicated.
- **Its vocabulary has left this workspace.** The module's public signatures name only its own
  concepts plus std and third-party ones — no domain word from this repo appears in them, and it
  would compile against nothing here. That is the observable form of "someone outside would want
  it" (`url` left Servo this way). It is a tell about ownership, not a plan to publish; publishing
  adds a version, a changelog, and MSRV and semver promises you then owe.

**Cheap to extract is not a reason to extract.** A module whose tests already run against it in
isolation and touch nothing else is cheap to move — run that as a feasibility check once a tell
has fired. On its own it justifies nothing.

## When extraction is wrong — leave it in place
The default is to leave it. A crate boundary is permanent in a way a module boundary is not, and
a rule that only ever says "extract" is worth as little as one that never does. Leave it when:

- **Only one side sees the boundary.** Every tell that fires does so from inside the module — no
  sibling imports it, nothing duplicates it, no cycle is forced. A boundary has two sides; one
  side is a module. Reach for `pub(crate)` and a module reorganization instead.
- **The public surface would be wider than the door.** Count the items that must become `pub` for
  the extracted crate to compile. If today's narrow door is three items and extraction needs
  fifteen, the coupling is real and you would be publishing it — permanently, with semver attached.
- **It would split a type from its impls.** The orphan rule cuts both ways: an extraction leaving
  the trait on one side and its natural impls on the other manufactures the very problem the
  orphan-rule tell describes. If the split forces a new newtype, it failed — put it back.
- **The type crosses public APIs and version skew would cost more than the build.** Two crates can
  sit at two versions in one graph, and the same type from two versions is two different types: a
  client on `url:0.5` cannot accept a `Url` from `url:1.0`. Within a single crate that state is
  unrepresentable. Weigh that before a compile-time win.
- **You are relying on inlining across the new seam.** Cross-crate inlining is not free — the
  compiler does not run LTO by default. A hot path split across a crate boundary needs `#[inline]`
  on the surface or `lto = "thin"` in the release profile, plus a before/after measurement.
- **The win is unmeasured.** A crate costs a `Cargo.toml`, a version, a changelog entry, an MSRV
  promise, a semver contract on everything `pub`, another row in `cargo audit` / `cargo deny`, and
  one more thing to move in lockstep at release. A build-time argument `cargo build --timings` has
  not confirmed does not pay for that.
- **It is one crate per type.** A crate exporting a single type consumed by a single sibling is a
  module wearing ceremony. Split per boundary, never per type.
- **The tell fired on code this task did not touch.** Noticing is not licence to reshape.

## Routing an extraction finding
The decision is `chief-architect`'s, and the work almost never belongs in the diff that revealed
it: an extraction is wider than the change that surfaced it, and `REDO-TO-BAR` reshapes only the
touched area, so it cannot carry a crate move.

- Report the change in front of you on its own merits — a fired tell does not alter its verdict.
- Raise the extraction as a **separate, non-blocking escalation** to `chief-architect`, naming
  which tells fired and where (`path:line`), and which were checked and did not. It is an
  ADR-grade call: `/architecture` to weigh the options against the counter-case above, then `/adr`
  to record the outcome.
- Give it a durable home so it outlives the session — file it through `/tech-debt`'s
  **Durable capture**, which turns a single finding into a tracked item instead of a line in a
  transcript. That is the one mechanism; do not invent a second.
- Never extract a crate as a side effect of another task.

## SOLID, expressed in Rust
- SRP — one reason to change. Enforce via struct decomposition and crate boundaries: each
  type and each crate owns a single concept.
- OCP — open for extension, closed for modification. Add behavior with default trait methods,
  and with `#[non_exhaustive]` on public enums/structs that may grow — but not reflexively:
  the forced `_` arm suppresses exhaustiveness checking, so an internal enum the workspace must
  handle completely is worse off with it. Full ruling in api.md ("Controlled growth").
- ISP — keep traits small and focused (one capability each, like `Display` or `Iterator`);
  do not bolt unrelated methods onto one god-trait.
- DIP — depend on traits at component boundaries, not on concrete types, so implementations
  can be swapped (real, mock, cached).
- Composition, not inheritance — Rust has none. Compose and delegate; never simulate
  inheritance with `Deref`, and never lean on `Deref` for polymorphism.
- One fact, one place — constants and invariants live in exactly one module and are re-exported
  (`pub use`) where else they are needed. No parallel test-vs-production definitions to drift
  out of sync.
