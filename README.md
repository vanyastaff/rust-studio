# vanya's Claude Code plugins

A personal [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces).

| Plugin | What it does |
|--------|--------------|
| [**rust-studio**](plugins/rust-studio) | Turns a Claude Code session into a full Rust engineering studio — a tiered agent team, path-scoped Rust standards, quality gates, and cargo-aware hooks. |

## Install

This repo is both a **marketplace** (`.claude-plugin/marketplace.json`, name `vanya`) and the
home of the `rust-studio` plugin under [`plugins/`](plugins). Install it locally — no GitHub
required:

```text
/plugin marketplace add C:\Users\vanya\rust-studio
/plugin install rust-studio@vanya
```

Full step-by-step (and the settings.json alternative) in [INSTALL.md](INSTALL.md).

## Publishing later

It's already marketplace-shaped. To share it, push this directory to a Git host and others
add it with `/plugin marketplace add <you>/rust-studio`. Before publishing, set `author`,
`repository`, and `homepage` in
[`plugins/rust-studio/.claude-plugin/plugin.json`](plugins/rust-studio/.claude-plugin/plugin.json)
and the marketplace [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

## Layout

```
rust-studio/                         (this repo = the "vanya" marketplace)
├── .claude-plugin/
│   └── marketplace.json             # lists the plugins
├── plugins/
│   └── rust-studio/                 # the plugin
│       ├── .claude-plugin/plugin.json
│       ├── agents/                  # 31 agent definitions
│       ├── skills/                  # 37 slash commands
│       ├── hooks/                   # hooks.json + 6 Bun/TypeScript scripts
│       ├── rules/                   # 9 path-scoped Rust standards
│       ├── docs/                    # protocol, roster, templates/
│       └── README.md
├── INSTALL.md
└── LICENSE
```

## License

MIT — see [LICENSE](LICENSE).
