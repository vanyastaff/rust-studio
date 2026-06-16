---
name: progress-bar
description: "progress bar statusline live visibility — set up the optional studio status line so the bottom bar shows the live orchestration phase (scout → plan → build → review) plus model and context %. Per-sub-agent rows in the agent panel are already on automatically; this wires the main bar, which a plugin cannot ship itself."
argument-hint: "[off — to remove it]"
user-invocable: true
---

# /progress-bar — wire the live status line

The studio already customizes **per-sub-agent rows** in the agent panel automatically (shipped in
the plugin `settings.json` as `subagentStatusLine`) — no setup needed. This skill wires the
**main status bar** (`statusLine`), which a plugin may NOT ship, so it has to live in your own
`~/.claude/settings.json`. Once set, the bottom bar shows:

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

1. **Off switch.** If `$ARGUMENTS` is `off`: remove the `statusLine` key from `~/.claude/settings.json`
   (leave everything else and the plugin's `subagentStatusLine` untouched), confirm, and stop.

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
