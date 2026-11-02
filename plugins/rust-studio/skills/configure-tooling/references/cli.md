---
name: cli
paths: "**/main.rs,**/bin/**,**/cli.rs,**/cli/**"
description: CLI / binary standards
---

# CLI Standards

Applies to binaries, `main.rs`, and CLI modules.

## Streams & exit codes
- **stdout is data, stderr is diagnostics.** Machine-readable output (for piping) goes
  to stdout; progress, logs, and errors go to stderr. Never interleave.
- Exit non-zero on failure. Reserve distinct codes for distinct failure classes; document
  them. `main` returns `Result` or maps errors to codes explicitly — no `unwrap` that
  prints an ugly panic to users.
- Respect `NO_COLOR`, detect TTY (`std::io::IsTerminal`) before emitting color/spinners.

## Argument parsing
- Use `clap` (derive). Provide `--help`/`--version`, sensible defaults, and
  `arg`-level help text. Validate at parse time; the rest of the program gets valid data.
- Support `-` for stdin/stdout where it makes sense; read config from flags > env > file.

## Errors & UX
- User-facing errors are actionable: what failed, why, and what to do next. No raw
  `Debug` of an error chain dumped at the user. Use `anyhow` + a top-level reporter.
- Long operations: progress on stderr, and a `--quiet` flag. Idempotent where possible.

## Robustness
- Handle `SIGINT`/`Ctrl-C` to clean up (restore terminal, remove temp files).
- Flush stdout before exit. Handle `BrokenPipe` (e.g. `… | head`) gracefully — exit 0,
  don't panic.
- Provide shell completions (`clap_complete`) for non-trivial CLIs.
