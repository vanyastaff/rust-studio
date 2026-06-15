# Large Rust workspaces — keeping Claude focused

How to scope the studio to the part of a big multi-crate workspace a task touches, so context
isn't burned on unrelated crates. This is the Rust mapping of Anthropic's official
[large-codebases guide](https://code.claude.com/docs/en/large-codebases); apply whichever
settings fit. Most are **project** settings you commit to the repo — the studio plugin is
global, but these live in the workspace it operates on.

## 1. Choose where to start Claude
- **From the workspace root** → every crate is readable; only the root `CLAUDE.md` loads at
  launch (subdir ones load on demand). Use when a task spans crates.
- **From one crate dir** (`crates/api/`) → that subtree only; that crate's `CLAUDE.md` + all
  ancestors load. Use when work is scoped to one crate. Cheapest context.

`.claude/settings.json` loads only from the directory you start in (not inherited like
CLAUDE.md), so each crate's settings file must be self-contained.

## 2. Layer `CLAUDE.md` by crate
A single root `CLAUDE.md` either bloats with every crate's conventions or stays too generic.
Split it:
- **Root `CLAUDE.md`**: workspace layout, layer/dependency direction, commit conventions, the
  workspace-wide bar (`clippy -D warnings`, MSRV, edition).
- **Per-crate `crates/<name>/CLAUDE.md`**: that crate's purpose, its test/dev commands, local
  invariants. Each crate's owner maintains it; commit them.

The studio's **path-scoped rules** (`../rules/`, matched by `paths:` glob from one central
place) are the complement: use per-crate `CLAUDE.md` for owner-maintained, code-versioned
conventions; use the central `rules/` for one-place standards that apply to many scattered
paths. They layer — both can apply to the same file.

## 3. Reduce what Claude reads
- **Code intelligence**: this plugin **bundles a rust-analyzer LSP** (`../.lsp.json`), so
  `rust-scout` (and you) jump to definitions / references and get diagnostics after each edit
  instead of scanning the tree — no extra plugin to install. It activates automatically once
  `rust-analyzer` is on PATH ([install it](https://rust-analyzer.github.io/manual.html#installation));
  if the binary is missing you'll see `Executable not found in $PATH` in the `/plugin` Errors
  tab and the studio falls back to file scanning. Diagnostics run via `cargo clippy`, matching
  the studio's zero-warning bar.
- **Block generated / vendored reads** in `.claude/settings.json` `permissions.deny`. Searches
  already respect `.gitignore` (so `target/` is out of search), but deny rules stop Claude
  *opening* checked-in generated code:
  ```json
  { "permissions": { "deny": [
    "Read(./**/target/**)",
    "Read(./**/*.generated.rs)",
    "Read(./**/vendor/**)",
    "Read(./**/*.rs.html)"
  ] } }
  ```
- **`claudeMdExcludes`** (in `.claude/settings.local.json`, gitignored) to skip CLAUDE.md for
  crates you never touch: `["**/crates/legacy-*/**", "**/crates/admin/**"]`.

## 4. Worktrees: check out only what you need
`--worktree` isolates changes; by default it checks out the whole tree. In a big workspace,
sparse-checkout only the crates a task needs, and symlink `target/` instead of duplicating it:
```json
{ "worktree": {
  "sparsePaths": [".claude", "crates/api", "crates/core"],
  "symlinkDirectories": ["target"]
} }
```
`sparsePaths` are repo-root-relative; root files (`Cargo.toml`, `Cargo.lock`,
`rust-toolchain.toml`) are always checked out. Include `.claude` so the studio's rules/settings
are present in the worktree. This also speeds up **subagent worktree isolation** (the studio's
parallel `team-*` agents) — list every crate any subagent needs.

> Note: deny rules and hooks must also be in the **repo-root** `.claude/settings.json`, because
> inside a worktree the working dir is the worktree root, not the crate you launched from.

## 5. Cross-crate access from a subdirectory
Starting from `crates/api/` but need to edit a shared type in `crates/core/`?
```json
{ "permissions": { "additionalDirectories": ["../core", "../../crates/shared"] } }
```
or at launch: `claude --add-dir ../core`. (`additionalDirectories` grants file access only —
it does **not** load that crate's CLAUDE.md/rules/skills.)

## 6. Scope & sequence a cross-crate change
- **Give the whole change to one session** — the shared edit + every call site — so the
  decisions stay consistent instead of being re-derived per crate. (Matches the studio's
  no-quick-wins / finish-the-ripple bar.)
- **Save the plan to a file before editing.** A long cross-crate session compacts its context;
  a written plan survives where chat history doesn't. The studio already does this — `/spec`
  persists `spec.md` and `/spec-tasks` persists `tasks.md` under `.rust-studio/specs/`. Use
  them for any change spanning more than one crate.

## 7. Studio entry points
- `/adopt` sets up this configuration for an existing workspace.
- `/detect-stack` reports workspace size and what to apply.
- See `${CLAUDE_PLUGIN_ROOT}/docs/templates/large-workspace-settings.json` for a ready-to-commit
  `.claude/settings.json`.
