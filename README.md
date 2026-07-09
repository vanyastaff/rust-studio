# Rust Code Studio

<p>
  <img src="https://img.shields.io/badge/skills-55-111111?style=flat-square" alt="55 skills">
  <img src="https://img.shields.io/badge/agents-33-111111?style=flat-square" alt="33 agents">
  <img src="https://img.shields.io/badge/works%20with-70%2B%20hosts-111111?style=flat-square" alt="Works with 70+ hosts">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

A Rust engineering studio for coding agents: 55 skills that carry the standards a strict crate
maintainer would apply, 33 agents arranged architect → leads → specialists, path-scoped rules,
and quality gates for libraries, async services, CLIs, and systems/embedded code.

The skills are [Agent Skills](https://agentskills.io) and run on any skill-capable host. The
agents, hooks and status line are a Claude Code plugin.

## Install

**One command. Finds the agents on your machine, asks which skills you want.**

```bash
npx skills add vanyastaff/rust-studio
```

Claude Code, Codex, Cursor, OpenCode, Zed, Copilot and ~70 other hosts. No npm publish, no
clone — the [skills CLI](https://github.com/vercel-labs/skills) reads this repo straight from
GitHub. Safe to re-run.

Each skill bundles the standards it cites under its own `references/`, so it works installed
alone.

<details>
<summary><strong>The full studio on Claude Code, or one skill on one agent</strong></summary>

<br>

The plugin adds the 33 agents, the hooks (session briefing, path-scoped rule injection, format
check, stop-guard) and the status line on top of the skills:

```text
/plugin marketplace add vanyastaff/rust-studio
/plugin install rust-studio@vanya
```

The desktop app has no `/plugin` command — add the marketplace from Customize → personal
plugins → Add from repository. Local clone, the `settings.json` alternative and the
Bun/rust-analyzer prerequisites live in **[INSTALL.md](INSTALL.md)**.

Narrower, without the prompts:

```bash
npx skills add vanyastaff/rust-studio --skill dev-task --agent codex -y
npx skills add vanyastaff/rust-studio --skill '*' --agent '*' -y
```

</details>

> [!NOTE]
> Four skills need the plugin and will say so when installed standalone: `/env-setup`,
> `/help`, `/progress-bar`, `/eval-agents`. They drive scripts that ship with the plugin.

## What you get, where

| | skills via `npx` | plugin on Claude Code |
|---|---|---|
| 55 skills | yes | yes |
| Standards the skills cite | bundled per skill | shared, plus injected by hook |
| 33 sub-agents | no — phases run inline | yes, spawned per phase |
| Session briefing, rule injection, stop-guard | no | yes |
| Status line, background monitors | no | yes |

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
./scripts/sync-references.sh          # rebuild the copies
./scripts/sync-references.sh --check  # what CI runs
```

`--check` fails on two things: a stale copy, and a skill that names a sub-agent without shipping
the fallback for hosts that have none.

## Releasing

The marketplace and plugin manifests validate clean (`claude plugin validate . --strict`). Bump
`version` in
[`plugins/rust-studio/.claude-plugin/plugin.json`](plugins/rust-studio/.claude-plugin/plugin.json)
— the single source of truth; the marketplace entry intentionally omits it — then tag and push:

```bash
cd plugins/rust-studio
claude plugin tag --push      # creates rust-studio--v<version> from the manifest
```

Full checklist: [`plugins/rust-studio/docs/releasing.md`](plugins/rust-studio/docs/releasing.md).

## Layout

```
rust-studio/                         (this repo = the "vanya" marketplace)
├── .claude-plugin/
│   └── marketplace.json             # lists the plugins
├── plugins/
│   └── rust-studio/                 # the plugin
│       ├── .claude-plugin/plugin.json
│       ├── .lsp.json                # bundled rust-analyzer LSP
│       ├── agents/                  # 33 agent definitions        (plugin only)
│       ├── skills/                  # 55 skills + bundled references/
│       ├── hooks/                   # hooks.json + Bun/TypeScript (plugin only)
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
