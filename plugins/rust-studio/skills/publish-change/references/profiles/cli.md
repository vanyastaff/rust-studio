# Command-line and terminal behavior

Use for clap commands, completions, ratatui/crossterm, streams and signals. Read
`references/cli.md`.

Map subcommands, flags, positional arguments, typed ValueParser/ArgGroup/ArgAction behavior
and flattening. Check shell completion targets (bash/zsh/fish/PowerShell) against command
definitions. Exercise each changed command with --help and its relevant parse/error paths.

## CLI-GATE

- ExitCode/Termination follows the documented command contract: success, usage and application
  failures are distinguishable, including early exits. Verify the convention in project rules.
- stdout carries machine data; stderr carries diagnostics. BrokenPipe has the intended
  quiet/success behavior when a consumer closes the pipe.
- IsTerminal, NO_COLOR and CLICOLOR_FORCE control color appropriately; piped output stays
  usable without accidental ANSI escapes.
- Ctrl-C/SIGINT, panic/error exits and TUI event-loop termination restore terminal state.
  Resource cleanup precedes exit and can be observed in tests.
- The project lint/test gate and changed-command smoke output are attached; terminal and
  shell cases not exercised are named explicitly.
