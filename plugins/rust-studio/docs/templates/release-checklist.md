<!-- Rust Code Studio template — copy this file into your project and fill in the blanks before each release. -->

# Release <version>

*e.g. `Release 1.4.0` — replace `<version>` with the exact semver tag you are cutting.*

---

## Pre-publish checklist

- [ ] **Semver bump correct (from /api-review)**
  *Confirm the version in `Cargo.toml` matches the change severity determined during API review: patch for fixes, minor for additive public API, major for breaking changes.*

- [ ] **CHANGELOG updated**
  *`CHANGELOG.md` has a dated entry for this version listing all notable changes, fixes, and deprecations. Unreleased section is now empty.*

- [ ] **MSRV verified in CI; `rust-version` accurate**
  *The `rust-version` field in `Cargo.toml` matches the oldest toolchain tested in CI. Run `cargo +<msrv> check --all-features` locally if unsure.*

- [ ] **`cargo test` / nextest green**
  *`cargo nextest run --all-features` (or `cargo test --all-features`) exits 0. Note any intentionally skipped tests here.*

- [ ] **`cargo clippy --all-targets --all-features -D warnings` clean**
  *No warnings emitted. If a lint was suppressed with `#[allow(...)]`, add a comment explaining why.*

- [ ] **`cargo fmt --check` clean**
  *`cargo fmt --check` exits 0. Run `cargo fmt` to fix if needed.*

- [ ] **Docs (rustdoc + README) updated; doc-tests pass**
  *`cargo test --doc` exits 0. `README.md` usage examples compile. All public items have doc-comments. `cargo doc --no-deps --all-features` renders without warnings.*

- [ ] **`cargo audit` / `cargo deny` clean**
  *`cargo audit` reports no unresolved vulnerabilities. `cargo deny check` passes all configured rules (licenses, bans, advisories).*

- [ ] **`cargo publish --dry-run` clean**
  *`cargo publish --dry-run` exits 0 and the reported package size looks reasonable. Verify `Cargo.toml` `include`/`exclude` lists are correct.*

- [ ] **Tag created (`vX.Y.Z`)**
  *Annotated git tag pushed: `git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`. Tag matches the version in `Cargo.toml`.*

---

## Manual publish steps (run by a human)

*Steps that require a crates.io token and must not be automated in CI.*

1. `cargo publish` — publish the crate to crates.io (requires `CARGO_REGISTRY_TOKEN`).
2. Create a GitHub Release from the tag; paste the CHANGELOG entry as the release body.
3. Mark the milestone closed in the issue tracker.

---

## Post-release (verify docs.rs, announce)

- [ ] **docs.rs build succeeded** — check `https://docs.rs/<crate>/<version>` once the build queue clears (usually < 15 min). Fix any doc-build errors with a patch release.
- [ ] **crates.io page looks correct** — description, repository link, license, and keywords are accurate.
- [ ] **Announcement sent** — post to relevant channels (e.g. `#releases` Slack/Discord, users mailing list, blog post, social) with a link to the GitHub Release and the key highlights.
- [ ] **Dependent crates / workspace members updated** — bump `Cargo.toml` path/version constraints in any internal consumers and open follow-up PRs as needed.

*Notes / known issues with this release:*

> *(leave blank if none)*
