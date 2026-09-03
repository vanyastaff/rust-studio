# Rust Code Studio

<p>
  <img src="https://img.shields.io/badge/skills-59-111111?style=flat-square" alt="59 skills">
  <img src="https://img.shields.io/badge/agents-33-111111?style=flat-square" alt="33 agents">
  <img src="https://img.shields.io/badge/works%20with-70%2B%20hosts-111111?style=flat-square" alt="Works with 70+ hosts">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

A Rust engineering studio for coding agents: 59 skills that carry the standards a strict crate
maintainer would apply, 33 agents arranged architect → leads → specialists, path-scoped rules,
and quality gates for libraries, async services, CLIs, and systems/embedded code.

The skills are [Agent Skills](https://agentskills.io) and run on any skill-capable host. The repo
also ships native plugin manifests for Claude Code and Codex. Claude Code gets the full ambient
studio (33 named agents, hooks, LSP, and status line); Codex gets the portable skills, the
host-neutral hooks (session stack briefing, routing and rustfmt nudges), and the 33 agents as
generated Codex custom agents — never Claude-specific lifecycle code.

## Install

**One command. Detects the agents on your machine and installs the right shape for each** —
full studio on Claude Code, native plugin on Codex, portable skills anywhere else:

```bash
./install.sh            # from a clone; --dry-run to preview
```

Or pick the skills interactively with the skills CLI:

```bash
npx skills add .
```

Claude Code, Codex, Cursor, OpenCode, Zed, Copilot and ~70 other hosts. No npm publish is needed:
the [skills CLI](https://github.com/vercel-labs/skills) reads a local clone or Git repository
directly. For a remote install, use `npx skills add <owner>/rust-studio`. Safe to re-run.

The 57 host-neutral workflows bundle their standards and deterministic helpers, so they work
installed alone. Two clearly labeled Claude utilities remain in the catalog for full-plugin use.

The plugin directory is also an [Agent Plugins 1.0](https://agent-plugins.org) package (root
`plugin.json` + flat `skills/`), which Codex ≥ 0.147, Cursor, GitHub Copilot CLI ≥ 1.0.74 and
Kiro load directly — the same skills, one more door.

<details>
<summary><strong>Install the plugin on Codex or Claude Code, or one skill on one agent</strong></summary>

<br>

Codex (repo marketplace + native `.codex-plugin` manifest):

```text
codex plugin marketplace add <owner>/rust-studio
codex plugin add rust-studio@rust-studio
```

Claude Code adds the 33 agents, hooks (session briefing, path-scoped rule injection, format
check, stop-guard), LSP, and status line on top of the skills:

```text
/plugin marketplace add <owner>/rust-studio
/plugin install rust-studio@rust-studio
```

The desktop app has no `/plugin` command — add the marketplace from Customize → personal
plugins → Add from repository. Local clone, the `settings.json` alternative and the
Bun/rust-analyzer prerequisites live in **[INSTALL.md](INSTALL.md)**.

Narrower, without the prompts:

```bash
npx skills add . --skill dev-task --agent codex -y
npx skills add . --skill '*' --agent '*' -y
```

</details>

> [!NOTE]
> `/progress-bar` and `/eval-agents` are Claude Code-only utilities and explicit-invocation-only
> in Codex. The other 57 skills, including `/env-setup` and `/help`, are standalone.

## What you get, where

| | skills via `npx` | Codex plugin | Claude Code plugin |
|---|---|---|---|
| 59 skills | yes | yes | yes |
| Standards the skills cite | bundled per skill | bundled per skill | shared + hook injection |
| 33 named studio agents | no — phases run inline | yes, after one generator step | yes, spawned per phase |
| Session briefing + path-scoped rule injection | no | yes | yes |
| Irreversible-action guard | no | yes | yes |
| Stop-guard, auto-capture, sub-agent verdict check | no | no — these read the Claude transcript | yes |
| LSP, status line, background monitors | no | no | yes |
| `claude plugin eval` suite (7 cases, no-plugin baseline arm) | no | no | yes |

> [!TIP]
> **Codex sub-agents take one command.** The plugin ships the agent briefs as Markdown; Codex
> wants TOML, so generate them once — `node plugins/rust-studio/scripts/generate-codex-agents.mjs`
> writes all 33 into `~/.codex/agents/` (pass a path for a project-local `.codex/agents/`).
> Re-run it after upgrading the plugin. Without this the skills still work — they just run each
> phase inline instead of delegating.

> [!TIP]
> A skill that says "delegate the build to `rust-builder`" runs that phase itself on a host
> with no sub-agents, rather than stalling. The rule is
> [`docs/sub-agents.md`](plugins/rust-studio/docs/sub-agents.md); every skill that names an
> agent ships a copy, and CI enforces it.

## The skills

Start with `/start` for a tour, or `/help` under the plugin for the live list.

| Group | Skills |
|---|---|
| Build one thing | `dev-task` `tdd` `fix-build` `verify-loop` `debug` `refactor` |
| Specify & design | `spec` `spec-tasks` `spec-verify` `architecture` `design-api` `model-domain` `adr` `brainstorm` `grill-me` |
| Review & audit | `review` `api-review` `doc-review` `security-audit` `audit-unsafe` `scope-check` `tech-debt` `bloat` |
| Test | `test-plan` `test-setup` `coverage` `mutants` `fuzz` `flaky-hunt` |
| Ship | `commit` `pr` `resolve-pr` `changelog` `publish` `msrv-check` `ci-gate` |
| Dependencies & perf | `add-dep` `deps-check` `perf` |
| Team pipelines | `team-api` `team-async` `team-perf` `team-release` |
| Memory | `recall` `remember` `session-wrap` |
| Setup | `start` `adopt` `new-crate` `detect-stack` `lint` `env-setup` `help` `progress-bar` `eval-agents` |

## Development

`docs/` and `rules/` are the single source of truth. Each skill carries a copy of what it cites
under `skills/<name>/references/`, so it stays self-contained when installed standalone.
Regenerate after editing either:

```bash
cd plugins/rust-studio
./scripts/sync-references.sh           # rebuild references + portable helpers
node scripts/generate-openai-metadata.mjs
./scripts/validate-distribution.sh     # what CI runs before Bun tests
```

Validation catches manifest/marketplace drift (all three manifests), non-standard skill
frontmatter, description-budget regressions, stale metadata or references, missing inline
fallbacks, vendor-only APIs leaking into the 57 portable skills, catalog drift (every skill
listed in `/help` and the usage guide), and malformed eval cases. CI also runs
`claude plugin validate --strict` and the [agnix](https://github.com/agent-sh/agnix)
agent-config linter.

## Releasing

The Claude and Codex manifests, marketplace entry, skill metadata, bundled references, and hook
tests are checked in CI. Keep the version in both plugin manifests identical, then tag and push:

```bash
cd plugins/rust-studio
claude plugin tag --push      # creates rust-studio--v<version> from the manifest
```

Full checklist: [`plugins/rust-studio/docs/releasing.md`](plugins/rust-studio/docs/releasing.md).

## Layout

```
rust-studio/                         (repo + neutral "rust-studio" marketplace)
├── .agents/plugins/
│   └── marketplace.json             # Codex marketplace
├── .claude-plugin/
│   └── marketplace.json             # Claude Code marketplace
├── plugins/
│   └── rust-studio/                 # the plugin
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── .lsp.json                # bundled rust-analyzer LSP
│       ├── agents/                  # 33 Claude agents + OpenAI UI metadata
│       ├── assets/                  # Codex install-surface artwork
│       ├── plugin.json              # Agent Plugins 1.0 manifest (Codex/Cursor/Copilot/Kiro)
│       ├── skills/                  # 59 skills + references + OpenAI metadata
│       ├── evals/                   # claude plugin eval suite (plugin only)
│       ├── hooks/                   # Claude hook config + Bun/TypeScript
│       ├── rules/                   # 20 path-scoped Rust standards
│       ├── output-styles/           # opt-in terse review style   (plugin only)
│       ├── monitors/                # background monitors         (plugin only)
│       ├── docs/                    # protocol, roster, releasing, templates/
│       ├── scripts/                 # sync-references.sh, env-setup.sh, statusline
│       └── README.md
├── INSTALL.md
└── LICENSE
```

## License

MIT — see [LICENSE](LICENSE).
