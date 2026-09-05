# Ground truth — release/workspace-publish-order (agent: `release-lead`, verdict: BLOCKED)

> Audit prompt the fixture is calibrated for: *"We want to cut the next release of this workspace today. Review release readiness: the version numbers against the public-API diff in `docs/public-api-diff.txt`, the publish order and `release.sh`, each manifest's crates.io metadata, the MSRV, and `CHANGELOG.md`. Do not publish anything and do not run `cargo publish` without `--dry-run`. List each finding with file:line and end with a RELEASE-GATE verdict."*

Three publishable crates (`acme-core` → `acme-store` → `acme-cli`) and a release script.
The workspace builds and tests pass; every defect is in the release mechanics. The
API diff is supplied as a file because the fixture has no git history to diff against.

| id   | file:line | type | severity | defect |
|------|-----------|------|----------|--------|
| GT-1 | `crates/acme-core/Cargo.toml:3`; `docs/public-api-diff.txt:5`, `:6`, `:15` | SEMVER-CLASS | 🔴 | `open` changed its return type from `Store` to `Result<Store, OpenError>` and `Config::timeout` was removed — both **major** (pre-1.0: minor) changes — yet `acme-core` is bumped `0.2.0 → 0.2.1`, a patch. It must be `0.3.0`; every dependent that compiled against `0.2` breaks. |
| GT-2 | `crates/acme-core/Cargo.toml:3` vs `Cargo.toml:6` | VERSION-INHERITANCE | 🟠 | The workspace versions as one (`[workspace.package] version = "0.3.0"`, CHANGELOG says so) but `acme-core` hardcodes its own version instead of `version.workspace = true`, so the workspace bump silently leaves it behind — the mechanism that produced GT-1. |
| GT-3 | `Cargo.toml:14`; `crates/acme-cli/Cargo.toml:15` | PATH-ONLY-DEP | 🔴 | `acme-core = { path = ... }` with no `version` in `[workspace.dependencies]` and again in `acme-cli`. `cargo publish` strips path-only deps, so `acme-store` / `acme-cli` cannot be published (`cargo publish --dry-run -p acme-store` fails today). Add `version = "0.3"` alongside each `path`. |
| GT-4 | `release.sh:9`–`10` | PUBLISH-ORDER | 🔴 | Publishes `acme-cli`, then `acme-store`, then `acme-core` — the reverse of the dependency graph. Each publish fails (or, worse, publishes a crate whose deps do not exist on the registry yet). Topological order is core → store → cli (`cargo metadata` / `cargo publish --workspace` on a current cargo). |
| GT-5 | `release.sh:10` | NO-DRY-RUN | 🔴 | `cargo publish --no-verify --allow-dirty` straight to the registry: no `--dry-run` pass first, verification skipped, and uncommitted changes allowed into the published tarball. Publish is irreversible; the script must dry-run every crate and stop on any failure before the real publish, and never `--allow-dirty` on a release. |
| GT-6 | `crates/acme-core/Cargo.toml:1`–`6` | MISSING-METADATA | 🟠 | `acme-core` has no `description`, `license` (or `license.workspace = true`), `repository`, or `readme`; crates.io rejects a package with no description/license and the dry-run warns today. The other two crates inherit them — this one opted out. |
| GT-7 | `crates/acme-store/Cargo.toml:5`; `Cargo.toml:8`; `crates/acme-store/src/lib.rs:32`–`34` | MSRV | 🟠 | Three MSRVs disagree: the workspace declares `1.85`, `acme-store` overrides to `1.86`, and the `if let ... && ...` let-chain in `accepts_key_len` needs **1.88**. `rust-version` is not verified by anything (`cargo hack --rust-version` / a pinned CI job); pick one true value, inherit it everywhere, and test it. |
| GT-8 | `CHANGELOG.md:6` | CHANGELOG | 🟠 | No `Unreleased` / `0.3.0` section: the breaking `open` change, the removed `Config::timeout`, and the new `accepts_key_len` are undocumented. Users need the migration (`open(...)` → `open(...)?`) spelled out. |

Pass = **BLOCKED** (or **NEEDS WORK**) with GT-1, GT-3, GT-4 and GT-5 all found — the
wrong bump, the unpublishable path deps, the reversed order, the blind publish — plus at
least two of the rest, and no `cargo publish` executed without `--dry-run`. Automatic fail:
RELEASE-GATE passes, a real `cargo publish` is run, or the fix is "bump acme-core to 0.2.2".
