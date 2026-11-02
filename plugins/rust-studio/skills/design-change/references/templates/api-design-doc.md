<!-- Rust Code Studio template — copy this file into your project and fill in every placeholder before review. -->

# API: <name>

*One-line name, e.g. `tokio_retry::RetryPolicy`. Use the public path callers will import.*

---

## Summary

*Two to four sentences: what problem does this API solve, who is the primary caller, and what is the intended usage pattern? Avoid mentioning implementation details here.*

---

## Goals / Non-goals

**Goals**

- *Goal 1 — e.g. "Provide a zero-copy path for reading frames from an async byte stream."*
- *Goal 2*
- *Goal 3*

**Non-goals**

- *Non-goal 1 — e.g. "This crate does not handle reconnection logic; callers own the transport."*
- *Non-goal 2*

---

## Public surface (types, traits, fn signatures)

*Sketch the exact items you intend to stabilize. Use `todo!()` / `unimplemented!()` for bodies. Every item here becomes a semver commitment.*

```rust
// src/lib.rs  (public re-exports)

/// <One-line doc comment for the main type.>
pub struct <TypeName> {
    // private fields omitted
}

impl <TypeName> {
    /// Creates a new `<TypeName>` with the given configuration.
    pub fn new(config: <ConfigType>) -> Self { todo!() }

    /// <What this method does and what it returns.>
    pub fn <method>(&self, arg: <ArgType>) -> Result<<OkType>, <ErrorType>> { todo!() }
}

/// <Trait callers can implement to plug in custom behaviour.>
pub trait <TraitName> {
    type Output;

    fn <required_method>(&self, input: &<InputType>) -> Self::Output;

    /// <Optional method with a default.>
    fn <optional_method>(&self) -> bool { false }
}

/// Builder / configuration type, if applicable.
#[derive(Debug, Clone)]
pub struct <ConfigType> {
    pub <field>: <FieldType>,
    // …
}

impl Default for <ConfigType> {
    fn default() -> Self { todo!() }
}
```

*Note any `#[must_use]`, `Send + Sync` bounds, `'static` requirements, or feature flags that gate items.*

---

## Error type

*Define the crate-level error enum. Follow the "one error type per crate" convention unless you have a strong reason not to.*

```rust
/// Errors returned by `<crate-name>` operations.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    /// Wraps I/O failures from the underlying transport.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// <Condition that causes this variant.>
    #[error("<human-readable message, ideally with context: {0}>")]
    <Variant>(<ContextType>),

    // Add variants here; mark the enum #[non_exhaustive] if callers
    // must not match exhaustively (e.g. you expect to add variants).
}

pub type Result<T> = std::result::Result<T, Error>;
```

*Explain which variants are expected to be recoverable vs. fatal.*

---

## Examples (doc-tests you intend to ship)

*Write at least one runnable example per major use-case. These will live in `///` doc comments or `examples/`. Paste the intended final form here.*

```rust
/// ```
/// use <crate>::{<TypeName>, <ConfigType>};
///
/// let cfg = <ConfigType>::default();
/// let client = <TypeName>::new(cfg);
///
/// let result = client.<method>(<arg>)?;
/// assert_eq!(result, <expected>);
/// # Ok::<(), <crate>::Error>(())
/// ```
```

*If async, wrap with `#[tokio::test]` or `tokio_test::block_on`. Note any `cfg(test)` helpers or fixtures needed.*

---

## Semver impact

| Category | Detail |
|---|---|
| **Change type** | New addition / Breaking change / Deprecation |
| **Current version** | `0.x.y` |
| **Target version after merge** | `0.x+1.0` or `1.x+1.0` |
| **`#[non_exhaustive]`** | List structs/enums marked non-exhaustive and why |
| **Sealed traits** | List any traits sealed via a private `Sealed` bound |
| **Deprecated items** | `#[deprecated(since = "x.y.z", note = "…")]` if replacing old API |

*If this is a minor bump, confirm no public type/trait/fn is removed or has its signature changed. If breaking, summarise the migration path in one paragraph.*

---

## Alternatives considered

*For each alternative you seriously evaluated, give a brief rationale for why it was rejected.*

1. **<Alternative A>** — *e.g. "Builder pattern instead of config struct." Rejected because `Default` on the struct is cheaper to construct in the common case and avoids an extra heap allocation.*
2. **<Alternative B>** — *Rejected because …*
3. **<Alternative C>** — *Rejected because …*

---

## Open questions

*List unresolved design decisions. Each item should have an owner and a deadline or a decision criterion.*

- [ ] **<Question 1>** — *e.g. "Should `<method>` take `&mut self` to allow state mutation, or stay `&self` with interior mutability?" Owner: @<handle>. Decide before merge.*
- [ ] **<Question 2>** — *Owner: @<handle>. Deadline: <date or milestone>.*
- [ ] **<Question 3>** — *Blocked on: <dependency or experiment>.*
