# Releasing Rust Code Studio

How to cut a release of **this plugin** (distinct from the crate-release checklist in
`templates/release-checklist.md`, which is for the Rust crates *you* build with the studio).

## Versioning model

- **Two manifests, one release version.** Keep `.claude-plugin/plugin.json` and
  `.codex-plugin/plugin.json` on the same `version`. Both marketplace entries intentionally omit
  a version; `scripts/validate-distribution.sh` rejects manifest drift. A root `plugin.json` is
  not one of them and must not be added back — see
  `adr/0002-agent-plugins-manifest-withdrawn.md`.
- **Explicit semver, bumped every release.** Because `version` is pinned, pushing commits without
  bumping it does nothing for installed users — Claude Code sees the same version and keeps the
  cached copy. Bump on every user-facing change.
- Follow [semver](https://semver.org): **MAJOR** for removed/renamed skills, agents, or gates that
  break existing workflows; **MINOR** for new skills/agents/rules/components or additive
  workflow modes; **PATCH** for fixes to existing behavior.

## Release steps

1. **Bump the version** in both manifests — `.claude-plugin/plugin.json` and
   `.codex-plugin/plugin.json`. There is no third: the Agent Plugins root `plugin.json` was
   withdrawn in 0.50.0 because its `$schema` silences every Codex hook
   (`adr/0002-agent-plugins-manifest-withdrawn.md`), and `RS-MANIFEST-058` fails the build if it
   comes back.
2. **Update the changelog / README and usage guide.** Move the pending entry under the new
   version and release date, retaining an empty `Unreleased` heading. Include changed behavior
   and component/eval counts; preserve historical entries and measured results.
3. **Regenerate and validate** from the plugin root:
   ```sh
   cd plugins/rust-studio
   ./scripts/sync-references.sh
   node scripts/generate-openai-metadata.mjs
   ./scripts/validate-distribution.sh
   bun test
   claude plugin validate . --strict
   claude plugin validate ../.. --strict
   agnix --strict .
   ```
4. **Smoke-test both distribution paths** from the marketplace root:
   ```sh
   cd ../..
   npx skills add . --skill env-setup --agent codex -y
   codex plugin marketplace add .
   codex plugin add rust-studio@rust-studio
   claude plugin marketplace add .
   claude plugin install rust-studio@rust-studio
   ```
   Confirm the standalone skill contains its script, the Codex plugin exposes all skills without
   auto-discovering `hooks/hooks.json`, and Claude still provides the SessionStart briefing,
   rule injection, and LSP diagnostics (needs `rust-analyzer` on PATH).
5. **Commit and push `main`.** Inspect the staged file list, including newly added reference
   copies and eval cases; exclude local logs, credentials and generated eval results. Commit
   the release and push `main` without force. Wait for the required plugin-quality jobs on
   that exact commit; an earlier green run does not cover the release. The relative-path
   marketplace source resolves `main`, so it must contain the new version.
6. **Tag and push** from inside the plugin directory after CI passes:
   ```sh
   cd plugins/rust-studio
   claude plugin tag --dry-run   # preview: rust-studio--v<version>
   claude plugin tag --push      # create the tag and push it
   ```
   `claude plugin tag` derives `rust-studio--v<version>` from the manifest, validates the plugin,
   and requires a clean working tree under the plugin directory. This tag convention is what lets
   downstream plugins resolve a `{ "name": "rust-studio", "version": "~0.5" }` dependency.
7. **Verify publication.** Confirm the remote branch and dereferenced tag point to the
   tested release commit, and that both manifests at that tag have the intended version.
   A GitHub Release can attach the same changelog entry to the existing tag; create it with
   `--verify-tag` so a typo cannot tag an unrelated revision. A pushed tag and marketplace
   update are the plugin distribution mechanism; no npm or crates.io publish is needed.

## How users receive it

- They install portable skills through `npx skills add <owner>/rust-studio`, or add the same
  repository as a marketplace to Codex or Claude Code.
- On `claude plugin update rust-studio@rust-studio` (or background auto-update) Claude Code compares the
  resolved version; a bumped `plugin.json` `version` is a new version, so the cache refreshes.
- Codex users run `codex plugin marketplace upgrade rust-studio` followed by
  `codex plugin add rust-studio@rust-studio`.
- To pin, users add the marketplace at a tag:
  `/plugin marketplace add <owner>/rust-studio@rust-studio--v0.30.0`.

## Component inventory before publishing

`claude plugin details rust-studio@rust-studio` prints the component inventory (skills, agents, hooks,
MCP servers, LSP servers) and the projected per-session token cost. Run it to confirm nothing
unexpected ships and that the always-on cost is reasonable.
