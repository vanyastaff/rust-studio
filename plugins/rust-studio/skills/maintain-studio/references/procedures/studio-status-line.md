# Configure the Claude Code status line

Use for `maintain-studio status-line` with the full plugin and Claude Code. The setting has
no Codex equivalent. Resolve `<plugin-root>/scripts/statusline.ts` and Bun before writing;
if either is absent, report the prerequisite and BLOCKED. Another host may prepare the
configuration, but must not claim a native status line was installed there.

The stable script is `<home>/.claude/rust-studio/statusline.ts`, with home resolved from the
host rather than a literal tilde. Claude does not expand `CLAUDE_PLUGIN_ROOT` in user
settings, and the installed plugin path changes with versions. Copy the script to the stable
path on installation, refresh and style changes. Its imports are runtime built-ins.

1. Read `<home>/.claude/settings.json`, treating absence as `{}`; preserve an existing file
   in `settings.json.bak` before changing it. Invalid JSON is a blocker, not an empty file.
   Construct and display the exact change to `statusLine`, preserving all other keys and
   the plugin's `subagentStatusLine`. Use authorization already given for this requested
   global-config change; request it only if the user has not authorized that change.
2. Apply the requested branch:

   | Input | Result |
   |---|---|
   | `off` | Remove only `statusLine`; retain the script and other settings. |
   | `nerd`, `emoji`, `symbols`, `text` | Refresh the script and add `--icons <style>` to its command. |
   | `ascii` | Refresh the script and add `--ascii`. |
   | Empty | Install or refresh the script and status-line configuration. |

   Unknown input needs correction before configuration changes. Nerd icons require a Nerd
   Font in the terminal; emoji is the default, symbols uses ordinary Unicode, text removes
   decorative icons and ASCII uses plain characters. Preserve explicitly selected styling
   during a refresh unless the request changes it.
3. For an enabled bar, write a `statusLine` object with `type: "command"`, a command of
   `bun "<absolute-stable-path>/statusline.ts"` plus the selected flags, and
   `refreshInterval: 10`. The interval keeps elapsed time and rate-limit countdowns moving
   while idle; event-only rendering freezes them. Read the saved settings back and verify
   the only changed key is `statusLine`.
4. Pipe a JSON object containing model display name, context used percentage and workspace
   current directory into `bun "<absolute-stable-path>/statusline.ts"` with the chosen
   flags. Require nonempty Studio output; if Bun is unavailable, report that the bar cannot
   render. For `off`, verify the saved settings no longer have `statusLine` instead.

Report the changed setting, backup/script paths and smoke result. The bar appears on the
next interaction; phase/task data comes from `.rust-studio/progress.json` when progress
tracking is enabled. A plugin update requires another refresh of the stable copy. This
configuration operation needs no version bump or commit.
