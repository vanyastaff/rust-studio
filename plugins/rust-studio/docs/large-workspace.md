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
- **Per-crate `crates/<name>/.claude/skills/`**: the project's *own* committed skills, one set
  per crate. Worth a file only for a procedure specific to that crate — regenerate its cbindgen
  header, replay its fuzz corpus, run its honest test command (§3). Context belongs in
  `CLAUDE.md`, standards in `rules/`, procedures in a skill.

The studio's **path-scoped rules** (`../rules/`, matched by `paths:` glob from one central
place) are the complement: use per-crate `CLAUDE.md` for owner-maintained, code-versioned
conventions; use the central `rules/` for one-place standards that apply to many scattered
paths. They layer — both can apply to the same file.

## 3. Per-crate commands: what is safe to scope, and what lies
§2 puts each crate's test/dev commands in its own `CLAUDE.md`. This is what those commands may
be. Anthropic's guide scopes commands per subdirectory but stops at compiled monorepos with deep
cross-directory dependencies — "may require project-specific build configurations". A Cargo
workspace is that case, and the mechanism is **feature unification**: cargo resolves features
once, over the whole package set it was asked to build. A crate compiled alone is not the same
crate as that crate compiled beside its siblings. So a scoped command is sound but incomplete —
every failure it reports is real, a pass proves only that one configuration.

Verified on cargo 1.98.0 / rustc 1.98.0, edition 2024, `resolver = "3"`.

**`cargo test -p core` at the root ≡ `cd crates/core && cargo test`** — same test binary
(identical `target/debug/deps/core-<hash>`), same features, same `Cargo.lock`, same shared
`target/`. Two things differ, neither about features:
- **`.cargo/config.toml` is discovered from the CWD upward.** A `crates/core/.cargo/config.toml`
  — aliases, `[env]`, `rustflags` — applies only from inside that crate and is silently ignored
  by `-p core` at the root. Keep anything a scoped command depends on at the repo root.
- **`default-members` binds the root, not the crate dir.** With `default-members = ["app"]`, a
  bare `cargo test` at the root builds and runs only `app`'s tests and prints green; no other
  crate is compiled. `cd crates/core && cargo test` ignores `default-members`. Never write bare
  `cargo test` as the workspace command — write `cargo test --workspace`.

### Safe to scope for the inner loop
```bash
cargo check  -p core
cargo clippy -p core --all-targets
cargo fmt    -p core
cargo hack --feature-powerset check -p core
```
`cargo clippy -p core` is wider than it looks: clippy lints **every workspace member in that
crate's dependency graph**, transitively, each under its own `[lints]`. `cargo clippy -p app`
reports findings in `core` and in `shared`, so a per-crate clippy line already covers what sits
beneath it.

### Four false greens
**1. A sibling turns on a feature you never asked for.** `app` depends on
`core = { features = ["extra"] }`; nothing in `core/Cargo.toml` changed:
```
$ cargo test -p core        →  test result: ok. 2 passed
$ cargo test --workspace    →  assertion failed: left: "extra", right: "plain"
```
Identical under `resolver = "1"`, `"2"` and `"3"`. The resolver version de-unifies build
dependencies, proc-macros and target-specific dependencies — never sibling workspace members in
one build. No resolver setting makes the scoped form honest.

**2. `--all-features` does not close it.** It activates all features of the *selected* package,
so it cannot see a feature a sibling turned on in a **shared dependency**:
```
$ cargo test -p core --all-features
test flavor_is_plain ..... FAILED   # caught: core's own `extra`
test shared_value_is_one . ok       # missed: `app` enables `shared/f`, so the workspace
                                    #   build links a different `shared` than this one
```
Strictly better than plain `-p core`, still not evidence. Diff `cargo tree -p core -e features`
against `cargo tree --workspace -e features`: if the crate's subtree differs, the scoped command
is exercising a configuration CI never builds.

**3. `--all-targets` drops doctests.** `cargo test --help` says so outright, and
`cargo nextest run` does not run doctests at all — so a crate whose invariants live in `///`
examples can hold a failing doctest behind a green per-crate line. Pair every scoped test command
with `cargo test -p core --doc`.

**4. `[workspace.lints]` reaches a crate only if that crate opted in.** Workspace lints do
survive a `-p` invocation, but only with this block in the member's manifest:
```toml
[lints]
workspace = true
```
Without it the crate falls back to clippy defaults: code that is `deny` elsewhere is a `warning`
here and `cargo clippy -p that-crate` exits 0. Audit which members are missing it:
```bash
rg -U --files-without-match '\[lints\]\nworkspace = true' crates/*/Cargo.toml
```

### The one honest scoped test command
Build the workspace, run one crate's tests — per-crate output, real feature set:
```bash
cargo nextest run --workspace -E 'package(core)'
```
Verified to reproduce the failure `cargo nextest run -p core` reports as green. `-E` is a nextest
filterset (`cargo nextest help filterset`); plain `cargo test` has no equivalent, since its `-p`
selects what to *build*, not what to *run*. Bare `cargo nextest run` at the root already defaults
to the whole workspace and is honest — `-p` is what breaks it. Put the `-E` form in the crate's
`CLAUDE.md`, not the `-p` form.

> **Scope for the loop, verify at the workspace.** Use `-p` while editing: its failures are real
> and its output is short. Before claiming anything passed, run the workspace form. The crate is
> the honest unit only when it declares no features of its own and shares no featured dependency
> with a sibling — `cargo tree -e features` settles that in one command. Everywhere else, "I ran
> the crate's tests" and "the tests pass" are different sentences, and a scoped command that
> converts the first into the second costs more than the context it saved.

Switching scopes does not thrash the build — feature sets get distinct metadata hashes and their
artifacts coexist, so you pay the first switch and it is cached after; the cost is disk, not
recompiles. Concurrency does bite: two cargo invocations against one `target/` serialize on
`Blocking waiting for file lock on build directory` — the trade behind §5's
`symlinkDirectories: ["target"]`.

## 4. Reduce what Claude reads
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

## 5. Worktrees: check out only what you need
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

### Worktree discipline for sub-agents (multi-checkout environments)
When parallel agents run in linked worktrees, the repo root is the OWNER's checkout —
possibly on a live branch with uncommitted WIP:
- Give every sub-agent the ABSOLUTE worktree path and the expected branch, with an explicit
  "operate only in this path, never the bare repo root" — non-isolated agents resolve
  relative paths against the main checkout and silently write there.
- Before committing, `git -C <worktree> branch --show-current` must equal the expected
  branch. A chained `cd <repo-root> && git add && git commit` lands on whatever branch the
  MAIN checkout has, not the worktree's.
- Verify a spawned branch's base before relying on it (`git merge-base <branch> main`) —
  isolation tooling does not guarantee an off-main base. To guarantee one, create the
  worktree explicitly from `main`.
- Commit early and BEFORE the final report — committed work survives an interrupted agent;
  an unwritten report does not.
- Prune finished worktrees (`/worktree-sweep`): each is a full checkout, they accumulate
  fast, and they break repo gates that scan the filesystem.

## 6. Cross-crate access from a subdirectory
Starting from `crates/api/` but need to edit a shared type in `crates/core/`?
```json
{ "permissions": { "additionalDirectories": ["../core", "../../crates/shared"] } }
```
or at launch: `claude --add-dir ../core`. (`additionalDirectories` grants file access only —
it does **not** load that crate's CLAUDE.md/rules/skills.)

## 7. Scope & sequence a cross-crate change
- **Give the whole change to one session** — the shared edit + every call site — so the
  decisions stay consistent instead of being re-derived per crate. (Matches the studio's
  no-quick-wins / finish-the-ripple bar.)
- **Save the plan to a file before editing.** A long cross-crate session compacts its context;
  a written plan survives where chat history doesn't. The studio already does this — `/spec`
  persists `spec.md` and `/spec-tasks` persists `tasks.md` under `.rust-studio/specs/`. Use
  them for any change spanning more than one crate.

## 8. Studio entry points
- `/adopt` sets up this configuration for an existing workspace.
- `/detect-stack` reports workspace size and what to apply.
- See `${CLAUDE_PLUGIN_ROOT}/docs/templates/large-workspace-settings.json` for a ready-to-commit
  `.claude/settings.json`.
