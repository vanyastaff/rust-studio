# Contributing to Rust Code Studio

## Layout

- `plugins/rust-studio/` — the plugin: `skills/`, `agents/`, `docs/`, `rules/`, `hooks/`.
- `plugins/rust-studio/docs/` and `rules/` are the **single source of truth** for standards.
- `plugins/rust-studio/skills/*/references/` is **generated** — never edit it by hand.
- `.claude-plugin/` + `.agents/plugins/marketplace.json` — Claude and Codex marketplaces;
  `plugins/rust-studio/.codex-plugin/plugin.json` — the Codex manifest.

## The one invariant

Skills must stay portable: any agent host that installs a single skill folder gets
everything that skill cites. So:

1. Edit canonical files in `docs/` or `rules/`, never the bundled copies.
2. Cite bundled files from a `SKILL.md` (or another doc) as `references/<name>.md`.
3. Regenerate: `./plugins/rust-studio/scripts/sync-references.sh` (CI fails on drift).

## Skill conventions

- Frontmatter keys: only `name`, `description`, `license`, `compatibility`, `metadata`,
  `allowed-tools`. `name` must match the directory.
- No host-specific APIs in portable skills (`CLAUDE_PLUGIN_ROOT`, `$ARGUMENTS`, task/team
  tool names, …) — describe capabilities instead; `validate-distribution.sh` enforces the
  exact list. `eval-agents` and `progress-bar` are the labeled Claude-only exceptions.
- `SKILL.md` under 500 lines; all 55 descriptions share a 6,500-character budget (Codex
  bounds the initial skill catalog).
- A side-effecting skill (publishes, commits, scaffolds) sets
  `allow_implicit_invocation: false` in `skills/<name>/agents/openai.yaml`; regenerate
  metadata with `node plugins/rust-studio/scripts/generate-openai-metadata.mjs`.
- A skill that names a studio sub-agent must cite `references/sub-agents.md` (directly or
  via `delegation.md`) so hosts without sub-agents get the inline fallback.

## Before you push

```sh
cd plugins/rust-studio
./scripts/validate-distribution.sh   # manifests, skills, metadata, references
bun test                             # hooks and status-line scripts
```

Both run in CI (`.github/workflows/sync-references.yml`); a PR that fails either does not
merge. Bump the version in **both** manifests and add a `CHANGELOG.md` entry when behavior
changes.
