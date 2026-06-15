# Installing Rust Code Studio

The plugin lives in this repo, which is itself a local Claude Code **marketplace** named
`vanya`. You can install it globally (applies to all your projects) without any GitHub remote.

## 1. Add the marketplace (one time)

In a Claude Code session:

```text
/plugin marketplace add C:\Users\vanya\rust-studio
```

or from the CLI:

```powershell
claude plugin marketplace add C:\Users\vanya\rust-studio
```

This registers the directory in `C:\Users\vanya\.claude\plugins\known_marketplaces.json`.

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
