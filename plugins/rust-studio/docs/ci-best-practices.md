# Rust CI best practices (2025-2026) — the studio's reference digest

Curated from current authoritative sources for the `/ci-gate` skill and the build/tooling agents.
Templates live in `${CLAUDE_PLUGIN_ROOT}/docs/templates/`. Tiers: **must** / **should** / **nice**.

## The one template to start from

**`jonhoo/rust-ci-conf`** — the de-facto reference set (Jon Gjengset): `check.yml` (fmt, clippy
stable+beta, doc, cargo-hack feature-powerset, cargo-semver-checks, MSRV), `test.yml` (stable/beta
matrix, `-Zminimal-versions`, macOS+Windows, llvm-cov→Codecov), `safety.yml` (miri, ASan/LSan, loom),
`nostd.yml`, `scheduled.yml` (nightly + dep-drift cron). All actions SHA-pinned, every file commented.
**Adopt and trim** rather than authoring from scratch. <https://github.com/jonhoo/rust-ci-conf>

## Foundational actions (must) — NOT actions-rs

`actions-rs/*` (toolchain, cargo, clippy-check, audit-check) was **archived 2023-10-13** (EOL Node12,
`set-output`). Treat any tutorial using it as outdated. Use instead:

| Action | Role | Note |
|--------|------|------|
| `dtolnay/rust-toolchain@stable` (or `@master` + `toolchain:`) | install toolchain + components | branch-versioned; SHA-pin `@master` if you need reproducibility |
| `Swatinem/rust-cache@v2` | build cache | place **after** toolchain (key includes rustc version); caches deps not your crates; sets `CARGO_INCREMENTAL=0` |
| `taiki-e/install-action@<tool>` | install CLI tools from prebuilt binaries (falls back to **`cargo binstall`**) | far faster than `cargo install`; do NOT SHA-pin the `@<tool>` shorthand |

**Tool install:** prefer **`cargo binstall <tool>`** locally and `taiki-e/install-action` in CI;
`cargo install` (compiles) only as fallback.

## Workflow hygiene (must)

- **`concurrency: { group, cancel-in-progress: ${{ github.ref != 'refs/heads/main' }} }`** — cancel superseded PR runs.
- **`permissions: contents: read`** at workflow top level; widen per-job only where needed.
- **`timeout-minutes`** on **every** job (default is 360 min / 6 h — a hung job burns the budget).
- **SHA-pin third-party actions** (`org/x@<40-char-sha> # vX`) after the March-2025 `tj-actions/changed-files` tag-mutation attack. Bump via Dependabot (`github-actions` ecosystem).
- **`env: RUSTFLAGS: "-D warnings"`** (not `#![deny(warnings)]` in source) **and** **`RUSTDOCFLAGS: "-D warnings"`** (RUSTFLAGS does not cover rustdoc).
- **`--locked`** on cargo invocations (fail on a stale lockfile).

## The quality gate (job split: fmt → clippy / test / doc)

| Gate | Command | Tier |
|------|---------|------|
| Format | `cargo fmt --all --check` | must |
| Lint | `cargo clippy --all-targets --all-features --locked -- -D warnings` | must |
| Test | `cargo nextest run --profile ci` **+ `cargo test --doc`** (nextest can't run doctests!) | should |
| Docs | `cargo doc --no-deps --all-features --document-private-items` (RUSTDOCFLAGS=-D warnings) | should |
| Features | `cargo hack check --feature-powerset --depth 2 --no-dev-deps` (full powerset on cron) | should |
| MSRV | pinned-toolchain job `cargo check` at your `rust-version` (re-check on dep bumps) | should |
| Unused deps | `cargo machete` (stable, PR) + `cargo udeps` (nightly, cron) | should/nice |
| Semver | `cargo semver-checks` / `obi1kenobi/cargo-semver-checks-action@v2` (release pipeline) | should |
| Coverage | `cargo llvm-cov --lcov` → `codecov/codecov-action@v5` (one Linux run) | nice |
| Typos | `crate-ci/typos` | nice |

**Matrix:** OS × toolchain (stable/beta/nightly) + a pinned MSRV leg; `fail-fast: false`. Keep it lean
on PRs, expand on merge/cron.

## Supply-chain & security (must/should)

- **`cargo-deny`** (`EmbarkStudios/cargo-deny-action@v2`) — one pass over advisories / bans / licenses
  / sources from `deny.toml`. Split `advisories` into a `continue-on-error` leg so a fresh CVE doesn't
  redden unrelated PRs. **Modern schema only** — pre-0.14 keys (`vulnerability`, `copyleft`,
  `allow-osi-fsf-free`, `unlicensed`, `default`) are removed and hard-error. See `templates/deny.toml`.
- **`rustsec/audit-check@v2`** on a weekly cron + on `Cargo.{toml,lock}` changes (catches newly
  disclosed CVEs against an unchanged lockfile). Replaces the dead `actions-rs/audit-check`.
- **Secret scanning + push protection** (GitHub setting). **Dependabot** for `cargo` + `github-actions`.
- **`cargo-vet`** (human supply-chain audits) and **`cargo-auditable`** (embed SBOM in shipped binaries)
  for high-assurance / binary-shipping projects. **OpenSSF Scorecard** for broadly-consumed libraries.

## Hang / correctness / determinism (the studio's anti-hang gate)

The theme: **convert a hang into a fast, attributable FAILURE** rather than statically detecting deadlock.

- **`cargo-nextest` `slow-timeout` + `terminate-after`** — the only mainstream per-test timeout; the
  single highest-leverage fix. `leak-timeout = { result = "fail" }` catches orphaned subprocesses;
  `retries` keeps flakes visible (FLAKY, not silent-green). See `templates/nextest.toml`. **must**
- **Job `timeout-minutes`** — last-resort backstop beneath nextest. **must**
- **clippy `disallowed_methods`** banning `SystemTime::now` / `Instant::now` / `thread::sleep` — attacks
  the root (inject the clock; bound delays). Only bites when run as `clippy -- -D warnings` in CI (it
  does NOT fail `cargo build`). Use **precise `std::time::` paths** (third-party `Instant` types false-
  positive). `allow_attributes_without_reason = "deny"` stops silent `#[allow]`. See `templates/clippy.toml`,
  `templates/workspace-lints.toml`. **must**
- **`miri`** (UB + deterministic clock/RNG, isolation ON) and **`cargo-careful`** (cheaper nightly UB
  checks) on a nightly job. **Sanitizers** (`-Zsanitizer=thread/address/leak` with `--target` +
  `-Zbuild-std`) for unsafe/FFI-heavy crates — TSan turns a latent race into a deterministic failure. **should**
- **`loom`** (exhaustive interleavings, `LOOM_MAX_PREEMPTIONS=2-3`) for hand-rolled lock-free code. **nice**
- **Benchmark-regression gating** (CodSpeed simulation mode, or bencher.dev `--error-on-alert`) — a hot
  path that 10×'s reads as a "hang" downstream. **should/nice**

## Top pitfalls (the studio flags these)

1. Using any `actions-rs/*` action — archived/EOL. → dtolnay/Swatinem/taiki-e.
2. Assuming `cargo nextest` runs doctests — it does **not**; add `cargo test --doc`.
3. Assuming `clippy.toml` bans fail the build — only with `clippy -- -D warnings` in CI.
4. Pinning actions by mutable tag instead of a full commit SHA.
5. Leaving `GITHUB_TOKEN` over-privileged (no `permissions:` block).
6. No `timeout-minutes` → a deadlocked test runs toward the 6-hour default.
7. Copy-pasting a pre-0.14 `deny.toml` (removed keys hard-error).
8. `--all-features` alone hides feature-additivity bugs → also run `cargo hack --feature-powerset`.
9. `cargo install`-ing tools in CI (slow) → `taiki-e/install-action` / `cargo binstall`.
10. Quarantining flakes with `#[ignore]` (deletes coverage) → nextest retries + fix the root cause.

## Sources

`jonhoo/rust-ci-conf` · `matklad.github.io/2021/09/04/fast-rust-builds.html` · `rustprojectprimer.com`
· `nexte.st/docs` · `github.com/dtolnay/rust-toolchain` · `github.com/Swatinem/rust-cache` ·
`github.com/taiki-e/install-action` · `github.com/taiki-e/cargo-hack` · `github.com/EmbarkStudios/cargo-deny`
· `github.com/rustsec/audit-check` · `embarkstudios.github.io/cargo-deny` · `mozilla.github.io/cargo-vet`
· `rust-lang.github.io/rust-clippy` · `github.com/rust-lang/miri` · `github.com/thomcc/cargo-careful` ·
`docs.rs/loom` · `codspeed.io/docs` · `bencher.dev/docs` · `release-plz.dev` · `github.com/axodotdev/cargo-dist`
· GitHub Actions security/syntax docs · OpenSSF Scorecard.
