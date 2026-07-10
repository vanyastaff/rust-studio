# Security Policy

## Supported versions

Only the latest release of Rust Code Studio receives security fixes. Update with
`/plugin update rust-studio` (Claude Code), `codex plugin add rust-studio@rust-studio`
(Codex), or re-run `npx skills add` (standalone skills).

## What this plugin runs

- **Skills** are markdown instructions interpreted by your agent — they execute nothing
  by themselves.
- **Hooks and the status line** (Claude Code install only) are local shell scripts running
  with your user's permissions. They read local state (git, cargo metadata, session
  transcripts) and make **no network calls**.
- **Bundled scripts** (`env-setup.sh`) install Rust tooling from rustup and
  crates.io/GitHub releases when *you* invoke them; nothing runs on install.
- The plugin collects **no telemetry**. See [PRIVACY.md](PRIVACY.md).

## Reporting a vulnerability

Report vulnerabilities privately via
[GitHub Security Advisories](../../security/advisories/new) — do not open a public issue.
Include the plugin version, the host (Claude Code / Codex / standalone skills), and a
reproduction. You will get an acknowledgement within a week.

Prompt-injection findings are in scope: a skill or bundled reference that can be leveraged
to make the agent exfiltrate data or run unintended commands is a vulnerability.
