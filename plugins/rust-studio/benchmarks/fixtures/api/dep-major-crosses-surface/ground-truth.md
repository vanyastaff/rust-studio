# Ground truth — api/dep-major-crosses-surface (agent: `api-design-lead`)

A release whose every mechanical check is green, including the one built to answer exactly this
question. The crate's own source did not change; only its `http` dependency went `0.2 → 1`, and
the version moved `0.1.0 → 0.1.1` — a **patch** bump.

Measured on cargo-semver-checks 0.50.0 / rustc 1.98.0 before this fixture was written; the
"no semver update required" line is real output, not invented for the fixture.

| id   | line  | type | severity | defect |
|------|-------|------|----------|--------|
| GT-1 | 15–24 | BREAKING CHANGE SHIPPED AS PATCH | 🔴 | `http`'s types cross the public surface three ways — a `pub fn` parameter (`normalize`), a re-export (`pub use http::Uri`), and a borrowed parameter (`split`). A caller holding an `http 0.2::Uri` cannot call any of them after the bump: it fails with `expected leaf::Uri, found http::Uri`. This is a **major** break (for `0.x`, a minor bump), never a patch. |
| GT-2 | 11–12 | GREEN TOOL, WRONG CONCLUSION | 🔴 | `cargo semver-checks` compares *this crate's* rustdoc, where the type is spelled `http::Uri` on both sides — so the bump renders identically and 196 checks pass. Its green is evidence that the crate's own API text is unchanged, **not** that the API is compatible. Treating the summary line as the semver verdict is the defect. The check that works here is whether the bumped dependency appears in the public surface at all (`cargo public-api`, or grepping `pub` items for its paths). |
| GT-3 | 19–20 | RE-EXPORT WIDENS THE BLAST RADIUS | 🟠 | `pub use http::Uri` makes this crate's semver permanently hostage to `http`'s: every future `http` major is a breaking release here, whether or not any signature changes. Worth naming as a design finding — wrap the type, or document the coupling deliberately. |

Pass = GT-1 and GT-2. GT-3 separates a correct review from a good one.

**Automatic fail**, whatever else was found, if the response accepts `cargo semver-checks`'s
"no semver update required" as the semver verdict, or approves the patch version bump.

A miss is a gap in the agent's prompt, not a reason to soften this file.
