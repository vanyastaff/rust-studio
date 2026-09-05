# Ground truth — docs/rustdoc-contract (agent: `docs-engineer`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Audit this crate's public documentation before we publish to docs.rs: crate-level docs, item docs, every doc-test as it would run under `cargo test --doc`, intra-doc links as `cargo doc` with `-D rustdoc::broken_intra_doc_links` would judge them, the `# Errors` / `# Panics` / `# Safety` contract sections, and README drift against the actual API. List each finding with file:line and end with a verdict."*

The crate builds and its unit surface is fine; every defect is in what rustdoc, the
doc-test runner, or a reader of the README would see. Two doc-tests fail today, one
intra-doc link is broken, and the README shows an API that does not exist.

| id   | file:line | type | severity | defect |
|------|-----------|------|----------|--------|
| GT-1 | `src/lib.rs:1` | CRATE-DOCS | 🟠 | No crate-level `//!` documentation and no `#![warn(missing_docs)]` (or `deny`), so docs.rs shows an empty landing page and new undocumented items land silently. |
| GT-2 | `src/lib.rs:38` | BROKEN-LINK | 🟠 | ``[`Limit::max`]`` links to an item that does not exist (the accessor is `Limit::count`); `cargo doc` with `-D rustdoc::broken_intra_doc_links` fails. |
| GT-3 | `src/lib.rs:50`–`54` | DOCTEST-PRIVATE | 🔴 | The `with_default_window` example calls `acme_limits::default_window()`, a private fn — `cargo test --doc` fails with E0603. Use public API in the example or hide setup lines with `#`. |
| GT-4 | `src/lib.rs:103`–`107` | DOCTEST-IO | 🔴 | The `fetch_remote_limit` example performs I/O against a URL at test time; it fails on every machine. Mark it `no_run` (keeping it compile-checked) and, ideally, show it with a local fixture. (Noting that the body reads the URL with `std::fs::read_to_string` is a bonus, not required.) |
| GT-5 | `src/lib.rs:90`, `:108` | MISSING-ERRORS | 🟡 | `parse_limit` and `fetch_remote_limit` return `Result` with no `# Errors` section naming which `ParseLimitError` variants can occur (`clippy::missing_errors_doc`). |
| GT-6 | `src/lib.rs:44` | MISSING-PANICS | 🟠 | `per_shard` divides by `shards` and panics on `0`; no `# Panics` section (`clippy::missing_panics_doc`). Either document it or make the API total (`NonZeroU32` / `Option`). |
| GT-7 | `src/lib.rs:114` | MISSING-SAFETY | 🔴 | `pub unsafe fn parse_limit_ptr` has no `# Safety` section stating the pointer contract (non-null, NUL-terminated, valid for reads, UTF-8 or not) — `clippy::missing_safety_doc` warns by default and the contract is the whole point of the `unsafe` marker. |
| GT-8 | `src/lib.rs:66`–`69`, `:119`–`121` | MISSING-DOCS | 🟡 | `ParseLimitError`'s three variants, `Bucket`, and both of its public fields are undocumented — each is a `missing_docs` warning once GT-1 is fixed. |
| GT-9 | `README.md:8`–`9` | README-DRIFT | 🔴 | The README example uses `Limit::new(10)` and `.max()`; neither exists (`Limit::per_second` / `.count()`). The README is never compiled — add `#![doc = include_str!("../README.md")]` (or a `doc = include_str!` test) so drift fails `cargo test --doc`. |

Pass = **NEEDS WORK** with GT-3, GT-4, GT-7 and GT-9 all found (the two failing doc-tests,
the missing safety contract, the README that lies) plus at least three of the rest.
Automatic fail: the docs are called publish-ready, or the agent edits source logic instead
of docs.
