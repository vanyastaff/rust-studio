---
name: detect-stack
description: "Classify / detect a Rust project's stack — reads Cargo.toml and workspace to identify domain(s) (library, async/web, CLI, systems/embedded) and report the relevant leads, specialists, and rules. Use before working on an unfamiliar project."
argument-hint: "[optional path to crate/workspace root]"
user-invocable: true
---

# /detect-stack — classify the project

Read the manifest(s) and report a concise profile. This is read-only investigation — proceed
autonomously; no approval needed.

## Steps
1. **Locate the root `Cargo.toml`** — use `$ARGUMENTS` if given, else cwd. Use Glob or `fd`
   to find it; do not shell out to `find`. If it contains `[workspace]`, list members and read
   each member's `Cargo.toml`.
2. **Extract** package/workspace name, `edition`, `rust-version` (MSRV), and the full
   `[dependencies]` / `[dev-dependencies]` / `[build-dependencies]` lists.
3. **Classify domain(s)** by dependency signals:
   - **library/crate** — `[lib]`, publishable metadata (`description`, `license`), no/secondary binary.
   - **async/web** — `tokio`, `axum`, `actix-web`, `hyper`, `tower`, `sqlx`, `async-std`.
   - **cli** — `clap`, `[[bin]]`, `ratatui`, `crossterm`.
   - **systems/embedded** — `#![no_std]`, `embedded-hal`, `cortex-m`, FFI (`bindgen`, `cc`), heavy `unsafe`.
   A project may be several at once.
4. **Note quality tooling** present/absent — use `rg` (the harness Grep tool) and Glob, not
   Bash `find`/`grep`:
   - Config files: `deny.toml`, `rust-toolchain.toml`, `.cargo/config.toml`
   - CI: `.github/workflows/`, `.gitlab-ci.yml`
   - Test/perf: `nextest` in config or deps, `criterion`/`proptest` in dev-deps
   - Safety posture: `#![forbid(unsafe_code)]` present, or `unsafe` blocks (use `rg unsafe`)

## Output
```
Project: <name>  ·  edition <ed>  ·  MSRV <ver>  ·  <N> workspace members
Domain(s): <library/crate, async/web, …>
Key deps: <tokio, axum, sqlx, …>
Tooling: deny.toml ✔ · rust-toolchain ✘ · nextest ✔ · criterion ✘ · CI ✔
```
Then: **relevant leads** (e.g. `async-systems-lead`, `api-design-lead`), **specialists**
from `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md`, and **path-scoped rules** that will
apply (`${CLAUDE_PLUGIN_ROOT}/rules/`).

If it's a **large workspace** (many `[workspace] members`), recommend the focus-scoping
setup from `${CLAUDE_PLUGIN_ROOT}/docs/large-workspace.md` — per-crate `CLAUDE.md`,
`permissions.deny` on `target/`/generated, serena MCP for symbol lookup, and sparse
worktrees — and offer to apply it via `/adopt`.

Finish with a one-line recommendation of which skill to run next.
