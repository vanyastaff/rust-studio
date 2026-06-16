# Ground truth — api/glob-reexport-uncurated (verdict: RESHAPE NEEDED)

> Mapped agent is `api-design-lead` (a pre-code lead), whose reject token is
> **RESHAPE NEEDED**. `REDO-TO-BAR` is the `rust-reviewer` equivalent — accept either as
> "rejected the shape".

The root of `acme-sdk`, the single published crate of a single-public-crate workspace. Its
entire value is a *curated* public surface; the two wholesale re-exports below surrender that
control. Compiles fine today, locks the crate's semver to internal crates forever.

| id   | line | type                        | severity | defect |
|------|------|-----------------------------|----------|--------|
| GT-1 | 16   | SURFACE (whole-crate re-export) | 🔴 | `pub use acme_engine;` republishes an entire internal crate as a public module. Every current **and future** `pub` item in `acme-engine` becomes part of `acme-sdk`'s public contract with no one deciding to — the opposite of curation, and it pins this crate's semver to an "internal" one. Replace with an explicit re-export list of the intended items (the `prelude` above is the right pattern). `cargo public-api` will show the surface blowup. |
| GT-2 | 20   | SURFACE (glob `*`)          | 🟠 | `pub use acme_graph::graph::*;` glob-exports an internal module, leaking implementation types (the petgraph-backed index internals). Glob re-exports surrender control of the surface and silently grow it on every upstream change; name the items you actually mean to export. |

Pass = the agent returns a reject verdict (**RESHAPE NEEDED**, or REDO-TO-BAR from a
reviewer) and flags **both** wholesale re-exports as uncurated surface that becomes a semver
contract — not just one. Recognizing that the `prelude` is the correct curated pattern (and the
two `pub use` lines should follow it) is a plus. ACCEPTABLE / "it compiles and re-exports are
convenient" is a fail.
