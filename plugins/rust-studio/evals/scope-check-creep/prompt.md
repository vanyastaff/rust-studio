---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
The story: "Add a `--json` flag to the `list` subcommand so scripts can consume its output." Here is what the branch actually changed. Is this diff in scope? What ships, what gets split out, and why?

```text
 crates/cli/src/commands/list.rs      | +48 -6    --json flag, JSON output path, tests for both formats
 crates/cli/src/commands/list.rs      | +31 -0    --yaml flag as well ("while I was in there")
 crates/cli/src/commands/mod.rs       | +12 -12   renamed `cmd_*` modules to `*_cmd` for consistency
 crates/cli/src/commands/show.rs      | +2 -2     same rename, call sites
 crates/cli/src/commands/export.rs    | +2 -2     same rename, call sites
 crates/core/Cargo.toml               | +1 -1     serde_json 1.0 -> serde_json 2.0-beta.1 (needed the new streaming API)
 crates/core/src/model.rs             | +19 -19   rustfmt of a file the diff did not otherwise touch
 crates/cli/src/output.rs             | +40 -0    new OutputFormat enum shared by list; used by the --json path
 CHANGELOG.md                         | +3 -0
```
