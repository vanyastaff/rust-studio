# vanya's Claude Code plugins

A personal [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces).

| Plugin | What it does |
|--------|--------------|
| [**rust-studio**](plugins/rust-studio) | Turns a Claude Code session into a full Rust engineering studio — a tiered agent team, path-scoped Rust standards, quality gates, and cargo-aware hooks. |

## Install

This repo is both a **marketplace** (`.claude-plugin/marketplace.json`, name `vanya`) and the
home of the `rust-studio` plugin under [`plugins/`](plugins).

From GitHub:

```text
/plugin marketplace add vanyastaff/rust-studio
/plugin install rust-studio@vanya
```

Or from a local clone (no GitHub required) — `/plugin marketplace add C:\Users\vanya\rust-studio`.
Full step-by-step (and the settings.json alternative) in [INSTALL.md](INSTALL.md).

## Publishing

The marketplace and plugin manifests validate clean (`claude plugin validate . --strict`), and
`author` / `repository` / `homepage` are set. To cut a release, bump `version` in
[`plugins/rust-studio/.claude-plugin/plugin.json`](plugins/rust-studio/.claude-plugin/plugin.json)
(the single source of truth — the marketplace entry intentionally omits `version`), then tag and
push:

```powershell
cd plugins/rust-studio
claude plugin tag --push      # creates rust-studio--v<version> from the manifest
```

Full release checklist: [`plugins/rust-studio/docs/releasing.md`](plugins/rust-studio/docs/releasing.md).

## Layout

```
rust-studio/                         (this repo = the "vanya" marketplace)
├── .claude-plugin/
│   └── marketplace.json             # lists the plugins
├── plugins/
│   └── rust-studio/                 # the plugin
│       ├── .claude-plugin/plugin.json
│       ├── .lsp.json                # bundled rust-analyzer LSP
│       ├── agents/                  # 33 agent definitions
│       ├── skills/                  # 55 slash commands
│       ├── hooks/                   # hooks.json + Bun/TypeScript scripts
│       ├── rules/                   # 20 path-scoped Rust standards
│       ├── output-styles/           # opt-in terse review style
│       ├── monitors/                # background monitors (PR CI status)
│       ├── docs/                    # protocol, roster, releasing, templates/
│       └── README.md
├── INSTALL.md
└── LICENSE
```

## License

MIT — see [LICENSE](LICENSE).
