---
name: api
paths: "**/lib.rs,**/src/lib.rs,**/src/protocol*.rs,**/src/types.rs"
description: Public API and semver standards for crate roots and public surface modules
---

# Public API Standards

Applies to crate roots (`lib.rs`), public surface modules, and anything re-exported as `pub`.

## Surface discipline
- Everything `pub` is a contract. Default to `pub(crate)`; promote to `pub`
  deliberately. Re-export the intended surface from the crate root; keep module
  paths from leaking. Respect `unreachable_pub`.
- For cross-crate growth, use `#[non_exhaustive]` on public enums (forces a `_` arm
  downstream) and on structs that may grow fields. For within-crate discipline only,
  a private marker field (`_priv: ()`) blocks outside record-literal/destructure
  without the `_` ceremony. `#[non_exhaustive]` has no effect inside the defining crate.
- Public structs that may grow fields: `#[non_exhaustive]` or constructor + getters
  (or a builder when there are many fields).
- Seal traits you don't want implemented downstream (private supertrait pattern).
- Don't expose third-party types in your public signatures unless that dependency is
  intentionally part of your contract (it pins your semver to theirs).
- On a fallible-consume API, return the consumed value in the error so the caller can
  retry without cloning — mirror `String::from_utf8` → `FromUtf8Error::into_bytes`:
  `fn send<T>(v: T) -> Result<(), SendError<T>>` where `SendError<T>` carries the `T` back.
- Spell out auto traits on returned trait objects — they do NOT inherit from the base
  trait: `Box<dyn Error + Send + Sync>`, not `Box<dyn Error>`. Set the lifetime
  explicitly when the default (`'static` for `Box`/`Arc`) is wrong: `Box<dyn Trait + 'a>`.
- Minimize `'static` bounds on the public surface; require them only when the type
  genuinely must outlive all references. `T: 'static` means "holds no borrowed data",
  not "lives forever" — don't over-constrain to silence a lifetime error.
- Keep generic methods dyn-compatible by marking them `where Self: Sized`; don't grow
  a `dyn`-used trait with a generic or `-> impl Trait`/`async fn` method that silently
  breaks `dyn Trait` for consumers.

## Documentation
- Every `pub` item has a rustdoc comment. Crate root has `//!` with a usage example.
- Public functions document: what it does, `# Errors`, `# Panics` (if any),
  `# Safety` (if `unsafe`), and at least one `# Examples` doc-test that compiles.
- Use intra-doc links (`[`Type`]`). `#![warn(missing_docs)]` on the crate.

## Semver
- Adding a variant to a non-`#[non_exhaustive]` enum, a field to a struct, or a
  method to a sealed-less trait is **breaking**. Know before you ship.
- Renames, signature changes, and removing `pub` items are major bumps.
- Adding a blanket impl to a fundamental type (`&T`, `&mut T`, `Box<T>`, `Pin<P>`) is a
  **major** breaking change — downstream impls can collide with the new blanket. For the
  orphan rule, `Box<LocalType>` counts as local, so you may impl a foreign trait for it.
- `#[must_use]` on `Result`-like returns (`#[must_use = "this `Result` may be an `Err`"]`)
  and on guard / builder types the caller must not silently drop;
  `#[deprecated(note = "...", since = "...")]` used deliberately.
- Run `cargo public-api` / `cargo semver-checks` before release; flag any break.

## Ergonomics
- Accept `impl Into<...>` / `impl AsRef<...>` at boundaries; return concrete types.
- Borrow the target, not the wrapper, in parameters: `&str`/`&[T]`/`&T`, not
  `&String`/`&Vec<T>`/`&Box<T>` (the wrapper form rejects `&'static str` and split slices).
- Provide `From`/`TryFrom` conversions (infallible vs fallible); implement standard
  traits (`Display`, `Error`, `Default`, `Iterator`) where they fit. Pair `new()` with
  `Default` when `new()` takes no arguments, and return `Self`.

## Errors
- A library MUST return a typed error, never `Box<dyn Error>` (reserve trait-object /
  `anyhow`-style errors for binaries and tests). The error taxonomy — `thiserror`-derived
  enums, `#[from]`/`#[error(transparent)]` wrapping, and the `# Errors` contract — lives in
  `${CLAUDE_PLUGIN_ROOT}/rules/error-model.md`; keep error-type design there.
