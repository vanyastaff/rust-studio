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
| crate roots/domain/service/model/manifests | `active-dev.md` | No shims/aliases/half-migrations in active development |
| crate roots/domain/protocol/manifests | `architecture.md` | Crate ownership, layering, sibling-crate reuse, workspace boundaries |
| domain/protocol/parser/error files | `types.md` | Newtypes/enums/typestate, lifetimes before allocation, dispatch shape |
| `**/src/lib.rs` | `api.md` | Public API: docs on pub items, semver, `#[non_exhaustive]`, sealed traits |
| `**/src/error*.rs`, `**/src/result*.rs` | `error-model.md` | Typed error taxonomy, boundary context, no string matching |
| services/workers/jobs/binaries | `observability.md` | Tracing spans, diagnostic fields, invariant visibility |
| `**/main.rs`, `**/bin/**`, `**/cli.rs` | `cli.md` | Exit codes, stdout=data/stderr=diag, clap, signals |
| `**/handlers/**`, `**/routes/**`, `**/server/**` | `async.md` | No blocking in async, cancellation, `Send` bounds, backpressure |
| `**/benches/**` | `perf.md` | Allocation awareness, measure-before/after, criterion |
| `**/tests/**`, `**/*_test.rs` | `testing.md` | Test layering, proptest, no flakiness, isolation |
| `**/build.rs` | `build-scripts.md` | Determinism, `rerun-if`, no network, minimal work |
| `**/Cargo.toml` | `cargo-manifest.md` | Feature hygiene, MSRV, metadata, no wildcard versions |
| `**/ffi*.rs`, `**/src/ffi/**`, `*-sys` crates | `ffi.md` | `extern` ABI, `#[repr(C)]`, null/ownership at the boundary, `// SAFETY:` |
| `**/*-macros`, `**/proc-macro*`, `**/macros/**` | `macros.md` | Hygiene, span-correct errors, generated-code soundness, no leaked deps |
| any `.rs` containing `unsafe` | `unsafe.md` (via hook) | `// SAFETY:` invariants, miri, no UB |

The `inject-rules` hook injects a *pointer* to each matching rule (name + one-line summary +
absolute path) before you read or edit a matching file; the agent reads the full standard on
demand. This keeps the relevant standard in front of the agent without re-dumping rule bodies
into the window on every file.

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
`permissions.deny` on `target/`/generated, the bundled rust-analyzer LSP for symbol lookup, and sparse
worktrees. Per-crate `CLAUDE.md` and the studio's central path-scoped `rules/` complement each
other (both can apply to one file). Full setup: [`large-workspace.md`](large-workspace.md);
run `/adopt` to apply it to an existing workspace.
