---
type: llm
weight: 4
---
The response reviews the semver impact of a release whose only change is a dependency major bump, shipped as a patch version, with a green `cargo semver-checks`.

Required (both):
1. **The release is breaking and the patch bump is wrong.** `http`'s types cross the public surface in three places — the `normalize` parameter (line 15), the `pub use http::Uri` re-export (line 20), and the `split` borrowed parameter (line 23). A caller holding an `http 0.2::Uri` cannot call any of them after the bump. For a `0.x` crate the correct bump is `0.2.0` (minor); the response must reject `0.1.1`.
2. **The green `cargo semver-checks` is not the semver verdict.** It compares this crate's own rustdoc, where the type is spelled `http::Uri` on both sides, so the change renders identically and passes. The response must explain that the tool's green means "this crate's API text is unchanged", not "the API is compatible", and should name the check that does work: whether the bumped dependency appears in the public surface at all (`cargo public-api`, or grepping `pub` items for its paths).

Discriminator (raises a pass to full credit): the `pub use http::Uri` re-export makes this crate's semver permanently hostage to `http`'s — every future `http` major becomes a breaking release here even with no signature change. Credit a response that names this as a design finding.

**Automatic fail**, whatever else was found, if the response accepts "no semver update required" as the semver verdict, or approves the `0.1.1` version.

Full credit: 1 and 2 plus the discriminator. Partial: 1 and 2. Fail: only one, none, or any automatic-fail behaviour.
