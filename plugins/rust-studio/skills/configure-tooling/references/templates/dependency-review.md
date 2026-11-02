<!-- rust-studio template: copy into your project and fill in each placeholder before merging a new dependency -->

# Dependency: <crate> <version>

*Replace `<crate>` and `<version>` with the exact crate name and semver string from Cargo.toml, e.g. `serde 1.0.197`.*

## Purpose (why we need it)

*One or two sentences explaining the specific problem this crate solves and why the standard library or an existing dependency cannot cover it.*

## Maintenance & popularity

*Fill in each field; leave a note if data is unavailable.*

| Field | Value |
|---|---|
| Latest release | *e.g. 2024-11-03* |
| Release cadence | *e.g. roughly monthly / irregular / abandoned* |
| crates.io downloads (recent) | *e.g. 12 M last 90 days* |
| Repository stars / forks | *e.g. 8 k / 420* |
| Open issues / PRs | *e.g. 34 issues, 7 PRs* |
| Bus factor | *e.g. 2 active maintainers, corporate-backed by Acme Corp* |
| MSRV | *e.g. 1.70* |

## License (and deny.toml compatibility)

*State the SPDX identifier(s), e.g. `MIT OR Apache-2.0`. Confirm it is listed (or explicitly allowed) in `deny.toml` under `[licenses]`. Flag any copyleft or non-OSI licenses that require legal sign-off.*

## Advisories (RUSTSEC / cargo-audit)

*Run `cargo audit` and paste any relevant findings below, or write "No known advisories" if clean. Include the RUSTSEC ID, severity, and affected version range for each finding.*

```
# paste cargo-audit output here, or: No known advisories as of <date>.
```

## Features enabled (and why default-features setting)

*List every Cargo feature flag being activated (or deactivated). Explain whether `default-features = false` is set and why. Example: disabling TLS backends to let the workspace choose a single one.*

```toml
# excerpt from Cargo.toml
serde = { version = "1", default-features = false, features = ["derive"] }
```

*Reason for this feature selection: ...*

## Alternatives considered

*Name at least one alternative crate or approach (including "write it ourselves") and briefly state why it was ruled out — e.g. lacking async support, GPL license, unmaintained, or significantly higher compile times.*

| Alternative | Reason not chosen |
|---|---|
| *crate-name* | *reason* |
| *roll-our-own* | *reason* |

## Decision (adopt / reject / vendor)

**Decision:** *Adopt / Reject / Vendor*

*One short paragraph justifying the decision. If adopting, note any follow-up actions (e.g. pin to a patch version, open an upstream issue, revisit at next audit cycle). If vendoring, state where the vendored copy lives and the process for applying upstream patches.*
