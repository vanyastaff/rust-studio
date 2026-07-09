---
name: error-model
paths: "**/src/error*.rs,**/src/errors*.rs,**/src/result*.rs"
description: Typed error taxonomy and boundary error standards
---

# Error Model Standards

Applies to error and result types.

## Typed taxonomy
- Library APIs expose meaningful typed errors, not `String`, broad `Box<dyn Error>`, or
  `anyhow::Error`. Returning `Box<dyn std::error::Error>` from a library function is an
  anti-pattern: define a typed `thiserror` enum instead. `anyhow::Error` / `eyre::Report` are
  acceptable only in binary crates and tests, never in a library's public return type.
- Error variants reflect domain failure modes. Do not add catch-all variants unless the
  boundary genuinely cannot know more.
- Preserve causes with `#[source]`, `#[from]`, and `#[error(transparent)]` so the source chain
  survives. Use `#[from]` to wrap a lower-level error (e.g. `Io(#[from] std::io::Error)`) and
  `#[error(transparent)]` to forward `Display`/`source` to an inner error unchanged.
- If an error can cross a thread boundary (spawned tasks, channels, `Send` futures), the boxed
  source must be `dyn std::error::Error + Send + Sync`, not bare `dyn Error`.
- On a fallible-consume operation, return the consumed value in the error variant instead of
  dropping it, so the caller can retry without cloning (mirrors `SendError<T>` and
  `String::from_utf8` → `FromUtf8Error::into_bytes`).
- No `unwrap`/`expect` on user or otherwise untrusted input — use `map_err(...)?` to surface a
  typed error. Reserve `unwrap`/`expect` for invariants the surrounding code guarantees
  (post-validation, unreachable branches, tests).

## Boundary context
- Add context at architectural boundaries, not at every `?`.
- Do not match errors by string. Match variants and fields.
- Public error types are part of the API: document them, consider `#[non_exhaustive]` for
  published crates, and keep variant names stable when external consumers exist.

## Diagnostics
- Error messages name the failed invariant or operation and enough identifiers to debug.
- Do not leak secrets, tokens, raw credentials, or private data through `Debug`, `Display`,
  tracing fields, or HTTP responses.
