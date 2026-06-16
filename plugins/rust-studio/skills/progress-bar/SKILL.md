---
name: progress-bar
description: "progress bar statusline live visibility icons theme — manage the studio status line (the rich Tokyo Night powerline bar). Auto-installed by default; use this to switch icon style (nerd / emoji / text), refresh after a plugin update, or remove it (off)."
argument-hint: "[nerd | emoji | text | ascii | off]"
user-invocable: true
---

# /progress-bar — manage the live status line

The studio already customizes **per-sub-agent rows** in the agent panel automatically (shipped in
the plugin `settings.json` as `subagentStatusLine`), and the **main status bar** (`statusLine`) is
**auto-installed into your `~/.claude/settings.json` on the first session** (the `statusline`
config, default on; a plugin may not ship a top-level `statusLine` itself). Use this skill to
**refresh** the installed script after a plugin update, **remove** it (`/progress-bar off`), or
**(re)install** it if you turned auto-install off. Once set, the bottom bar shows:

```
🦀 rust-studio  ·  <project>  ·  ▸ build 2/4  ·  Opus  ·  ctx 41%
```

The `▸ <phase>` segment appears while an orchestrating skill (`/dev-task`, `team-*`, …) is running
with `progress_tracking` on — they write `.rust-studio/progress.json`, which the bar reads.

## Why a stable copy (read first)

`${CLAUDE_PLUGIN_ROOT}` is **not** substituted inside user `settings.json`, and the plugin install
path is version-pinned (it changes on every plugin update). So this skill **copies** the status-line
script to a stable path and points `settings.json` there. After you update the plugin, **re-run
`/progress-bar`** to refresh the copied script with any improvements.

## Steps

1. **Argument routing.** Inspect `$ARGUMENTS`:
   - `off` → remove the `statusLine` key from `~/.claude/settings.json` (leave everything else and
     the plugin's `subagentStatusLine` untouched), confirm, and stop.
   - `nerd` | `emoji` | `text` | `ascii` → this is an **icon-style switch**. Resolve the stable
     script path (step 2), then set `statusLine.command` to include the matching argument:
     `bun "<stable>/statusline.ts" --icons nerd` (or `emoji` / `text`), or
     `bun "<stable>/statusline.ts" --ascii` for `ascii`. **`nerd`** uses sleek FontAwesome icons and
     **requires a Nerd Font installed in your terminal** (e.g. set the terminal font to
     "JetBrainsMono Nerd Font"); **`emoji`** (default) needs no special font; **`text`** drops
     decorative icons. Back up settings, write only `statusLine` (do steps 4 + 6 confirm), report,
     and stop. (Copy the script first so the path exists.)
   - empty / anything else → (re)install / refresh, per the steps below.

2. **Resolve paths.** Home dir = `$HOME` (or `%USERPROFILE%` on Windows). Stable dir =
   `<home>/.claude/rust-studio/`. Plugin script = `${CLAUDE_PLUGIN_ROOT}/scripts/statusline.ts`.

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
   argument. `refreshInterval: 10` keeps the bar current while you wait on background sub-agents
   (the event-driven refresh goes quiet when the main session is idle).

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
