---
name: progress-bar
description: "Use when running Claude Code and configuring, refreshing, or removing the Rust Code Studio status line."
disable-model-invocation: true
---

# /progress-bar — manage the live status line

> **Claude Code plugin only.** This manages Claude's `statusLine` setting and has no Codex
> equivalent. Resolve `<plugin-root>` as the directory two levels above this `SKILL.md` (or use
> `CLAUDE_PLUGIN_ROOT` when Claude provides it). Installed standalone, the script is absent.

The studio already customizes **per-sub-agent rows** in the agent panel automatically (shipped in
the plugin `settings.json` as `subagentStatusLine`), and the **main status bar** (`statusLine`) is
**auto-installed into your `~/.claude/settings.json` on the first session** (the `statusline`
config, default on; a plugin may not ship a top-level `statusLine` itself). Use this skill to
**refresh** the installed script after a plugin update, **remove** it (`/progress-bar off`), or
**(re)install** it if you turned auto-install off. Once set, the bottom bar shows:

```
🦀 rust-studio · 📁 rust-studio ·  main ●4 · PR #42 ✓ · Opus 5 · think:high
📊 47% · 5h 24% ·1h58m · 7d 41% ·2d · $8.42 · 🕐 1h12m · +156 −23
```

The `▸ <phase>` segment appears while an orchestrating skill (`/dev-task`, `team-*`, …) is running
with `progress_tracking` on — they write `.rust-studio/progress.json`, which the bar reads.

### What the bar shows

| Segment | Source | Notes |
|---|---|---|
| `🦀 rust-studio` | — | Always present; collapses to the crab on a narrow terminal |
| `📁 <project>` |  `workspace.project_dir` | Project root, not the current subdirectory |
| ` <branch> ●N ↑N ↓N` | `git` | Cached ~5s; truncated when the terminal is not roomy |
| `PR #42 ✓` | `pr.*` | Review state as a glyph, clickable (OSC 8) via `pr.url`. `MR !42` for a GitLab merge request (`pr.kind === "mr"`) |
| `⎇ <name>` | `worktree.name` / `workspace.git_worktree` | Scope hint — only outside the main working tree |
| `Opus 5` · `think:high` · `⚡` | `model`, `effort.level`, `thinking.enabled`, `fast_mode` | |
| `📊 47%` | `context_window.used_percentage` | Color escalates green → yellow → red |
| `🔥 ▁▂▄▆ 2.1k/min` | derived | Burn rate over the last 10 min, with a pace sparkline |
| `5h 24% ·1h58m` | `rate_limits.*` | Percentage **and** the countdown to the window reset |
| `$8.42` | `cost.total_cost_usd` | |
| `🕐 1h12m` · `+156 −23` | `cost.*` | |

**The alert slot.** Anything only worth a column when it goes wrong shares one rotating segment, by
descending urgency: `spend_limit` ≥ 85% → a 5h/7d limit ≥ 85% → prompt-cache hit rate < 70% (with
the harness's own miss attribution, e.g. `⚠ 💾 62% — tools added`) → extra `/add-dir` scope. When
nothing is wrong the slot is empty — a calm bar is the normal state.

**Adaptive layout.** Claude Code exports the terminal width as `COLUMNS`. At ≥120 columns the bar
uses two rows; below that it merges into one and drops segments — least decisive first — until the
line fits. Identity, git, PR and context percentage are never dropped.

## Why a stable copy (read first)

`CLAUDE_PLUGIN_ROOT` is **not** substituted inside user `settings.json`, and the plugin install
path is version-pinned (it changes on every plugin update). So this skill **copies** the status-line
script to a stable path and points `settings.json` there. After you update the plugin, **re-run
`/progress-bar`** to refresh the copied script with any improvements.

## Steps

1. **Argument routing.** Inspect `input`:
   - `off` → remove the `statusLine` key from `~/.claude/settings.json` (leave everything else and
     the plugin's `subagentStatusLine` untouched), confirm, and stop.
   - `nerd` | `emoji` | `symbols` | `text` | `ascii` → this is an **icon-style switch**. Resolve the
     stable script path (step 2), then set `statusLine.command` to include the matching argument:
     `bun "<stable>/statusline.ts" --icons nerd` (or `emoji` / `symbols` / `text`), or
     `bun "<stable>/statusline.ts" --ascii` for `ascii`. **`nerd`** = sleek FontAwesome icons and
     **requires a Nerd Font installed in your terminal** (e.g. "JetBrainsMono Nerd Font");
     **`emoji`** (default, 📁 📊 💾 🕐) needs no special font; **`symbols`** = plain Unicode glyphs
     (⌂ ◔ ↻ ⏱) that render in a normal monospace font; **`text`** drops decorative icons. Back up
     settings, write only `statusLine` (do steps 4 + 6 confirm), report, and stop. (Copy the script
     first so the path exists.)
   - empty / anything else → (re)install / refresh, per the steps below.

2. **Resolve paths.** Home dir = `$HOME` (or `%USERPROFILE%` on Windows). Stable dir =
   `<home>/.claude/rust-studio/`. Plugin script = `<plugin-root>/scripts/statusline.ts`.

3. **Copy the script.** Create `<home>/.claude/rust-studio/` and copy `statusline.ts` there
   (`<home>/.claude/rust-studio/statusline.ts`). It is a single self-contained `bun` file.

4. **Read + back up settings.** Read `~/.claude/settings.json` (treat absent as `{}`). Back it up to
   `~/.claude/settings.json.bak`.

5. **Merge — do not clobber.** Add only the `statusLine` key (preserve every existing key):

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "bun \"<ABSOLUTE path to home>/.claude/rust-studio/statusline.ts\"",
       "refreshInterval": 10
     }
   }
   ```

   Use an **absolute** path (resolve `~`), since the shell will not expand `~` inside the quoted
   argument. `refreshInterval` is **not optional garnish**: Claude Code re-renders the status line
   only on conversation events (token usage, permission mode, vim mode, model, fast mode, effort,
   thinking, PR status) — never on a clock. Without it the duration and rate-limit countdowns freeze
   whenever the session sits idle. The SessionStart hook tops this key back up if it ever goes
   missing from a `statusLine` that still points at the studio script; a `statusLine` pointing
   anywhere else is left strictly alone.

6. **Confirm (outward action).** Show the exact diff to the user and get approval **before** writing
   `~/.claude/settings.json` — this edits their global config. On approval, write it.

7. **Verify + report.** Smoke-test the copied script:
   `echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":20},"workspace":{"current_dir":"<home>"}}' | bun "<home>/.claude/rust-studio/statusline.ts"`
   — expect a `🦀 rust-studio …` line. Tell the user: the bar updates on the next interaction; the
   `▸ phase` segment shows during `/dev-task`-style runs; re-run `/progress-bar` after a plugin
   update; `/progress-bar off` removes it.

## Notes

- Never touch keys other than `statusLine`. Never remove the plugin's `subagentStatusLine`.
- If `bun` is not on PATH, the bar silently shows nothing — tell the user to install bun.
- This is config setup, not a code change: no version bump, no commit needed.
