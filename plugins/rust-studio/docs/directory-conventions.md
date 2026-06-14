# Rust Code Studio — Directory Conventions

The studio assumes idiomatic Cargo layout and scopes its path-based rules (see
`../rules/`) to these locations. You don't have to follow this exactly — the rules
match on globs and degrade gracefully — but this is what the agents expect.

```
my-crate/                or   my-workspace/
├── Cargo.toml                ├── Cargo.toml            # [workspace]
├── rust-toolchain.toml       ├── Cargo.lock
├── deny.toml                 ├── deny.toml
├── src/                      ├── crates/
│   ├── lib.rs   (API root)   │   ├── core/
│   ├── main.rs  (binary)     │   │   ├── Cargo.toml
│   ├── bin/                  │   │   └── src/lib.rs
│   └── <modules>/            │   ├── api/
├── benches/    (criterion)   │   │   └── src/lib.rs
├── tests/      (integration) │   └── cli/
├── examples/                 │       └── src/main.rs
├── build.rs                  ├── benches/
└── README.md                 ├── tests/
                              └── xtask/            # dev-tooling crate
```

## Path → rule mapping (see `../rules/`)

| Location | Rule file | Enforces |
|----------|-----------|----------|
| `**/*.rs` | `core.md` | Idiomatic Rust, error handling, clippy-clean, ownership |
| `**/src/lib.rs` | `api.md` | Public API: docs on pub items, semver, `#[non_exhaustive]`, sealed traits |
| `**/main.rs`, `**/bin/**`, `**/cli.rs` | `cli.md` | Exit codes, stdout=data/stderr=diag, clap, signals |
| `**/handlers/**`, `**/routes/**`, `**/server/**` | `async.md` | No blocking in async, cancellation, `Send` bounds, backpressure |
| `**/benches/**` | `perf.md` | Allocation awareness, measure-before/after, criterion |
| `**/tests/**`, `**/*_test.rs` | `testing.md` | Test layering, proptest, no flakiness, isolation |
| `**/build.rs` | `build-scripts.md` | Determinism, `rerun-if`, no network, minimal work |
| `**/Cargo.toml` | `cargo-manifest.md` | Feature hygiene, MSRV, metadata, no wildcard versions |
| any `.rs` containing `unsafe` | `unsafe.md` (via hook) | `// SAFETY:` invariants, miri, no UB |

The `inject-rules` hook injects the matching rule as context right after you edit a
matching file, so the relevant standard is always in front of the agent.

## Domain detection

The `session-start` hook and `/detect-stack` skill classify a project by reading
`Cargo.toml`:

- **library/crate** → `[lib]` present, or no `[[bin]]`, often `publish`-able
- **async/web** → depends on `tokio`, `axum`, `actix-web`, `hyper`, `tower`, `sqlx`
- **cli** → depends on `clap`, has `[[bin]]`, `ratatui`
- **systems/embedded** → `#![no_std]`, depends on `embedded-hal`, `cortex-m`, has `unsafe`, FFI (`bindgen`, `cc`)

A project can be several at once; the studio loads the relevant leads/specialists
for each.

## Large multi-crate workspaces
For big workspaces (nebula/surge/flui-scale), scope context to the crate a task touches rather
than loading everything: per-crate `CLAUDE.md` (owner-maintained, layered on the root one),
`permissions.deny` on `target/`/generated, `rust-analyzer-lsp` for symbol lookup, and sparse
worktrees. Per-crate `CLAUDE.md` and the studio's central path-scoped `rules/` complement each
other (both can apply to one file). Full setup: [`large-workspace.md`](large-workspace.md);
run `/adopt` to apply it to an existing workspace.
