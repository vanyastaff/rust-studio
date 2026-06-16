# Installing Rust Code Studio

The plugin lives in this repo, which is itself a Claude Code **marketplace** named `vanya`.
Install it globally (applies to all your projects) either from GitHub or from a local clone.

## 1. Add the marketplace (one time)

### From GitHub (anyone)

```text
/plugin marketplace add vanyastaff/rust-studio
```

or from the CLI:

```powershell
claude plugin marketplace add vanyastaff/rust-studio
```

Claude Code clones the repo, so the relative `./plugins/rust-studio` source resolves correctly.
Pin to a tag with `@ref`, e.g. `vanyastaff/rust-studio@rust-studio--v0.7.0`.

### From a local clone (no GitHub needed)

```text
/plugin marketplace add C:\Users\vanya\rust-studio
```

or:

```powershell
claude plugin marketplace add C:\Users\vanya\rust-studio
```

Either way registers the marketplace in `~/.claude/plugins/known_marketplaces.json`.

## 2. Install the plugin

```text
/plugin install rust-studio@vanya
```

or:

```powershell
claude plugin install rust-studio@vanya
```

Installing globally (user scope) makes the agents, skills, hooks, and rules available in
**every** project you open.

## Alternative: declare it in settings.json

Edit `C:\Users\vanya\.claude\settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "vanya": {
      "source": { "source": "directory", "path": "C:\\Users\\vanya\\rust-studio" }
    }
  },
  "enabledPlugins": {
    "rust-studio@vanya": true
  }
}
```

## 3. Verify

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
`routing_nudge`, `fmt_nudge` — all on by default — plus an Obsidian `vault_path`). There's also an
opt-in **`stop_guard`** (+ `stop_guard_strict`) that mechanically blocks an undisciplined turn
ending (ownership-dodging, test avoidance, "done" without evidence) — off by default. Change them
later via `/plugin` → **Rust Code Studio** → configure. The plugin also ships an opt-in
`Rust review (terse)` output style — select it under `/config` → Output style. Full table:
[`plugins/rust-studio/README.md`](plugins/rust-studio/README.md#configuration).

## Updating

Edit files under `plugins/rust-studio/` and they take effect on the next session (local
marketplace reads from disk). If you installed a pinned copy, run:

```text
/plugin marketplace update vanya
```

## Uninstall

```text
/plugin uninstall rust-studio@vanya
/plugin marketplace remove vanya
```
