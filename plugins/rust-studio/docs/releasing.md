# Releasing Rust Code Studio

How to cut a release of **this plugin** (distinct from the crate-release checklist in
`templates/release-checklist.md`, which is for the Rust crates *you* build with the studio).

## Versioning model

- **Single source of truth: `plugin.json` `version`.** The marketplace entry in
  `../../.claude-plugin/marketplace.json` intentionally omits `version` — when both are set
  `plugin.json` wins silently, which masks drift. Keep it in one place.
- **Explicit semver, bumped every release.** Because `version` is pinned, pushing commits without
  bumping it does nothing for installed users — Claude Code sees the same version and keeps the
  cached copy. Bump on every user-facing change.
- Follow [semver](https://semver.org): **MAJOR** for removed/renamed skills, agents, or gates that
  break existing workflows; **MINOR** for new skills/agents/rules/components; **PATCH** for fixes
  to existing behavior.

## Release steps

1. **Bump the version** in `plugin.json` (`version`).
2. **Update the changelog / README** if component counts or behavior changed.
3. **Validate** from the marketplace root:
   ```sh
   claude plugin validate . --strict                    # marketplace.json
   claude plugin validate ./plugins/rust-studio --strict # plugin manifest + frontmatter
   ```
   `--strict` turns warnings (e.g. a misspelled manifest field) into failures — use it in CI.
4. **Smoke-test locally**:
   ```sh
   claude plugin marketplace add .
   claude plugin install rust-studio@vanya
   ```
   Open a Rust project and confirm the SessionStart briefing, a path-scoped rule injection, and
   LSP diagnostics (needs `rust-analyzer` on PATH).
5. **Tag and push** from inside the plugin directory:
   ```sh
   cd plugins/rust-studio
   claude plugin tag --dry-run   # preview: rust-studio--v<version>
   claude plugin tag --push      # create the tag and push it
   ```
   `claude plugin tag` derives `rust-studio--v<version>` from the manifest, validates the plugin,
   and requires a clean working tree under the plugin directory. This tag convention is what lets
   downstream plugins resolve a `{ "name": "rust-studio", "version": "~0.5" }` dependency.
6. **Push `main`** so the relative-path marketplace source resolves the new commit.

## How users receive it

- They added the marketplace via `vanyastaff/rust-studio` (GitHub) or a local path.
- On `claude plugin update rust-studio@vanya` (or background auto-update) Claude Code compares the
  resolved version; a bumped `plugin.json` `version` is a new version, so the cache refreshes.
- To pin, users add the marketplace at a tag: `/plugin marketplace add vanyastaff/rust-studio@rust-studio--v0.8.0`.

## Component inventory before publishing

`claude plugin details rust-studio@vanya` prints the component inventory (skills, agents, hooks,
MCP servers, LSP servers) and the projected per-session token cost. Run it to confirm nothing
unexpected ships and that the always-on cost is reasonable.
