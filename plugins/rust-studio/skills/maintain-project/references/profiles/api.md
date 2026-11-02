# Public API and errors

Use for exported signatures, types, traits, errors, re-exports and compatibility. Read
`references/api.md`, `references/types.md` and
`references/error-model.md`; apply the project edition and MSRV.

## Contract checks

- Inventory exports with `cargo public-api`, including cfg/macro-generated items and re-export
  chains. Trace downstream construction, matching, implementations and real call sites.
  Classify each change as patch/minor/major and run `cargo semver-checks` against the baseline.
- Check structural breaks: removed/renamed items, changed signatures/fields/visibility,
  tightened bounds, added required trait methods and accidental third-party type exposure.
  A claim that nobody uses an export requires reverse-dependency/caller evidence or deprecation.
- New blanket impls over fundamental wrappers (`&T`, `&mut T`, `Box<T>`, `Pin<P>`) can
  conflict with downstream impls. Treat them as breaking until compatibility is established.
- Adding `#[non_exhaustive]`, a private marker field or sealing to an existing open API can
  break consumers. Choose evolution policy up front. Non-exhaustiveness constrains downstream
  crates, not the defining crate; externally implementable traits must remain open by intent.
- Preserve `Send`, `Sync`, `Unpin`, `UnwindSafe` and `RefUnwindSafe` promises across exposed
  types/futures. Spell out needed auto traits and lifetimes on returned trait objects.
- Preserve dyn compatibility: generic methods, associated constants, unconstrained `Self`,
  AFIT and RPITIT require an appropriate static-only `Self: Sized` method, extension trait or
  explicit boxed-future interface when dynamic dispatch is required. Exercise a real dyn caller.
- Choose borrowing, ownership, `Into`/`AsRef`, iterators and GATs for caller ergonomics rather
  than generic complexity alone. Compare validated constructors, typestate and builders from
  the invariant. Builders return `Self`; annotate must-handle guards/builders/result-like types
  with a useful `#[must_use]` message and account for lint compatibility.
- `From` is total and infallible; validating conversions use `TryFrom`. Standard `Display`,
  `Error`, `Iterator`, `IntoIterator`, `Default`, `Clone` and `Copy` impls honor type semantics.
  Fallible consumption returns the moved value on error when retry/recovery requires it.
- Library boundaries expose typed errors, normally `thiserror`; `anyhow`/`eyre` and erased
  errors belong at application/test boundaries. Preserve `Error::source`, intentional
  `#[from]` mappings and transparent wrapping instead of string flattening. Thread-crossing
  errors meet `Send + Sync`; separate retryable and fatal categories without leaking internals.
- Untrusted parse/config/network input returns typed errors. An invariant-only `expect` needs
  an adjacent proof. Evaluate `miette` for source spans, labels and help when end users need them.
- A compatibility alias/forwarder needs an explicit deprecation and removal policy; active-dev
  breaking changes should migrate real callers and remove obsolete paths.

## API-GATE

Record the surface diff, semver verdict and downstream evidence, including the hazards above
that automated semver checks miss. No accidental exports or unplanned dependency types remain.
Every public item has appropriate docs and compiling examples: load `documentation.md` for
that evidence. Missing tooling, target coverage or consumer evidence stays unverified.
