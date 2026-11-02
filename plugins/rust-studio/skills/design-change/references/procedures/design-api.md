# Design a public API

Use `references/profiles/api.md`, `references/api.md` and `references/rust-guidelines.md`.
Refine the same context/spec and review under `references/elephant-workflow.md`. An existing
API diff audit belongs to `/review-work` in api mode.

1. Inventory current types, traits, sibling primitives/error taxonomy, feature boundaries,
   call sites and tests. Distinguish internal, downstream and crates.io consumers. Their
   construction, matching and implementation patterns define stability constraints. Derive
   sync/async, ownership, borrowing and Send/Sync requirements from those callers.
2. Compare 2–4 distinct shapes when there is a meaningful fork: signatures, ordinary call
   sites, structural invariants, invalid states still constructible, failure/recovery,
   misuse, and three likely extensions or a two-year horizon. Justify new items against reuse.
   Verify ecosystem claims and versions. Resolve technical defaults from evidence and ask
   only for unresolved product or compatibility decisions.
3. Design typed domain errors, normally a `thiserror` enum, with variants, Display/Error
   behavior and useful From conversions. An operation consuming a retryable value returns
   it on failure unless cheap reconstruction or unrecoverability justifies otherwise.
4. Specify stability and sealing deliberately: growing cross-crate types/errors, private
   markers, permitted downstream trait implementations, and appropriate `#[must_use]`.
   Evaluate real downstream construction and exhaustive matching before restricting an
   existing type. SemVer review includes blanket impls on fundamental types, removal of
   `#[non_exhaustive]` and removal of public marker fields. Diff size cannot establish PATCH.
5. Use `references/templates/api-design-doc.md` as the surface checklist within the spec or
   linked appendix: every public type/trait/signature, doc-comment stub, conversion, error,
   feature gate and rationale, stability marker, primary call-site doctest skeleton, and
   BREAKING / MINOR / PATCH classification with triggering items. Include migration/removal,
   failure contracts and acceptance. Record required architecture/MSRV ADRs.

API-GATE requires documented public items, understood SemVer impact, intentional stability,
sealing and must-use behavior, and no accidental public exports. Use a fresh reviewer with
the API profile and an adversarial lens for new-trait, cross-crate or boundary-moving
designs. Authorship cannot supply independent sign-off. Changes to reviewed contracts require
artifact correction and affected fresh review. API-design-only work stops at that result.
