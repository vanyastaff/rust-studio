# Installing Rust Code Studio

The plugin lives in this repo, which exposes a neutral `rust-studio` marketplace for both Codex
and Claude Code. Install only the portable skills, the Codex skill bundle, or the full Claude
studio.

## One command, every host

`install.sh` detects the agent CLIs on your machine and runs each host's native install:
the full studio on Claude Code, the native plugin on Codex, and the portable skills via the
skills registry when neither CLI is found. From a clone it installs offline from the local
path. Safe to re-run; `--dry-run` prints the commands without running them.

```bash
./install.sh
```

## Just the skills, on any agent

The 62 skills are [Agent Skills](https://agentskills.io) and install into Claude Code,
Codex, Cursor, OpenCode, Zed and ~70 other hosts — no npm publish, no clone:

```text
npx skills add .                                      # from a local clone
npx skills add <owner>/rust-studio --skill dev-task --agent codex
```

The 60 host-neutral workflows bundle the standards and deterministic helpers they need. What you
*don't* get this way: the 33 sub-agents, the hooks (session briefing, path-scoped rule injection,
stop-guard), the status line, and working versions of the two clearly labeled Claude-only
utilities (`/progress-bar`, `/eval-agents`). Skills that name a sub-agent fall back to running
that phase inline — see
[`docs/sub-agents.md`](plugins/rust-studio/docs/sub-agents.md).

## Agent Plugins (Cursor, GitHub Copilot CLI, Kiro, Codex)

`plugins/rust-studio/` carries a root `plugin.json` in the cross-vendor
[Agent Plugins 1.0](https://agent-plugins.org) format — `$schema` + `name`, skills discovered
from the flat `skills/` directory. Any client that implements it (Codex ≥ 0.147, Cursor, Copilot
CLI ≥ 1.0.74, Kiro) can install the plugin directory directly and gets the 62 skills; hooks,
agents, LSP, and status line stay with the Claude Code and Codex manifests beside it.

## Codex plugin

The Codex plugin installs the portable Rust workflows with native install-surface metadata,
plus the host-neutral lifecycle hooks (session stack briefing, routing nudge, rustfmt nudge,
pre-compaction warning — they need [Bun](#hooks-need-bun) on PATH). It does not run the
Claude-specific pieces: status line, LSP, or transcript-reading hooks.

Hooks are trust-gated: Codex does not run a plugin's hooks until you approve them once —
accept the trust prompt in your first interactive session and the session briefing appears
from then on (trust is persisted per hook in `~/.codex/config.toml`).

Codex plugins cannot bundle agent definitions, so `./install.sh` (from a clone, with node)
also generates the 33 studio agents into `~/.codex/agents/` as Codex custom agents. Manual
equivalent:

```text
node plugins/rust-studio/scripts/generate-codex-agents.mjs            # ~/.codex/agents
node plugins/rust-studio/scripts/generate-codex-agents.mjs .codex/agents   # per-project
```

```text
codex plugin marketplace add <owner>/rust-studio
codex plugin add rust-studio@rust-studio
codex plugin list
```

For a local clone, replace the GitHub shorthand in the first command with the absolute repository
path. Restart the ChatGPT desktop app after adding the marketplace; start a new Codex task after
installing so the complete skill catalog is loaded.

## Full Claude Code studio

### 1. Add the marketplace (one time)

### From GitHub (anyone)

```text
/plugin marketplace add <owner>/rust-studio
```

or from the CLI:

```powershell
claude plugin marketplace add <owner>/rust-studio
```

Claude Code clones the repo, so the relative `./plugins/rust-studio` source resolves correctly.
Replace `<owner>` with the repository owner. Pin to a tag with `@ref`, for example
`<owner>/rust-studio@rust-studio--v0.30.0`.

### From a local clone (no GitHub needed)

```text
/plugin marketplace add C:\path\to\rust-studio
```

or:

```powershell
claude plugin marketplace add C:\path\to\rust-studio
```

Either way registers the marketplace in `~/.claude/plugins/known_marketplaces.json`.

### 2. Install the plugin

```text
/plugin install rust-studio@rust-studio
```

or:

```powershell
claude plugin install rust-studio@rust-studio
```

Installing globally (user scope) makes the agents, skills, hooks, and rules available in
**every** project you open.

### Alternative: declare it in settings.json

Edit your `~/.claude/settings.json` (on Windows, `%USERPROFILE%\.claude\settings.json`):

```json
{
  "extraKnownMarketplaces": {
    "rust-studio": {
      "source": { "source": "directory", "path": "C:\\path\\to\\rust-studio" }
    }
  },
  "enabledPlugins": {
    "rust-studio@rust-studio": true
  }
}
```

### 3. Verify

```text
/help                 # should show the Rust Code Studio catalog
/plugin               # rust-studio listed and enabled
```

```powershell
claude plugin list
```

Open a Rust project (one with a `Cargo.toml`) and start a session — the **SessionStart**
hook prints a stack briefing (crate, edition, MSRV, detected domain). Try:

```text
/rust-studio:start
/rust-studio:detect-stack
```

> Plugin slash commands are namespaced `/rust-studio:<name>`. Where a name is unambiguous,
> `/<name>` works too.

## Hooks need Bun

The hooks are TypeScript and run via [`bun`](https://bun.sh). Check with `bun --version`.
If a machine lacks `bun` on PATH:

- macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
- Windows: `powershell -c "irm bun.sh/install.ps1 | iex"` (or `winget install Oven-sh.Bun`),
  then ensure `bun.exe` is on PATH.
- If Bun is absent, the hooks **no-op safely** — the studio still works, you just lose
  automatic path-scoped rule injection (including the unsafe-code standard), session-start stack
  detection + memory recall, and the fmt nudge.

Each hook reads stdin behind a hard timeout and arms a watchdog that force-exits if anything
stalls, so a hook can never freeze the session — even mid-subagent.

## Code intelligence needs rust-analyzer

The plugin bundles a rust-analyzer LSP (`plugins/rust-studio/.lsp.json`) — diagnostics (via
`cargo clippy`) and go-to-definition after each edit. It activates automatically **only if the
`rust-analyzer` binary is on PATH**:

```powershell
rustup component add rust-analyzer        # via rustup, or
winget install rust-lang.rust-analyzer    # standalone
```

Verify with `rust-analyzer --version`. If the binary is missing you'll see
`Executable not found in $PATH` in the `/plugin` **Errors** tab — the studio keeps working and
falls back to file scanning. See [the rust-analyzer manual](https://rust-analyzer.github.io/manual.html#installation)
for other platforms.

## Configuration

On enable, Claude Code prompts for the studio's options: behavioral defaults (preferred test
runner, gate intensity, house MSRV fallback) and toggles for ambient behaviors (`memory_recall`,
`routing_nudge`, `fmt_nudge` — all on by default — plus a `memory_dir` override for the project memory store). There's also an
opt-in **`stop_guard`** (+ `stop_guard_strict`) that mechanically blocks an undisciplined turn
ending (ownership-dodging, test avoidance, "done" without evidence) — off by default. Change them
later via `/plugin` → **Rust Code Studio** → configure. The plugin also ships an opt-in
`Rust review (terse)` output style — select it under `/config` → Output style. Full table:
[`plugins/rust-studio/README.md`](plugins/rust-studio/README.md#configuration).

## Updating

Edit files under `plugins/rust-studio/` and they take effect on the next session (local
marketplace reads from disk). If you installed a pinned copy, run:

```text
/plugin marketplace update rust-studio
```

For Codex, refresh the configured Git marketplace and reinstall the plugin:

```text
codex plugin marketplace upgrade rust-studio
codex plugin add rust-studio@rust-studio
```

## Uninstall

```text
/plugin uninstall rust-studio@rust-studio
/plugin marketplace remove rust-studio
```

Codex:

```text
codex plugin remove rust-studio@rust-studio
codex plugin marketplace remove rust-studio
```
