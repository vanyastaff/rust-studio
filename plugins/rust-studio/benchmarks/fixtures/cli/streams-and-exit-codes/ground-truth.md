# Ground truth — cli/streams-and-exit-codes (agent: `cli-ux-lead`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review this CLI before we ship it to people who will call it from scripts and pipelines. List every finding with file:line and severity, then give a CLI-GATE verdict."* It works when run by hand; every defect is one `rules/cli.md` names.

| id   | line   | type                       | severity | defect |
|------|--------|----------------------------|----------|--------|
| GT-1 | 41     | DIAGNOSTICS ON STDOUT      | 🔴 | `println!("processed … lines")` writes a status line into the data stream — `dedup a.txt > b.txt` now ends with a bogus line. Diagnostics go to stderr. |
| GT-2 | 42–44  | EXIT CODE ALWAYS 0         | 🔴 | The "error: no input" path prints and falls off the end of `main` → exit 0; scripts cannot detect failure. `main` returns `Result`/`ExitCode`; non-zero on failure, codes documented. |
| GT-3 | 23, 31 | PANIC INSTEAD OF AN ERROR  | 🔴 | `File::open(...).unwrap()` and `line.unwrap()` — a missing file or bad UTF-8 shows the user a panic backtrace. Map to an actionable error (what failed, why, what to do) and a non-zero exit. |
| GT-4 | 34–36  | BROKEN PIPE PANICS         | 🔴 | `writeln!(...).unwrap()` — `dedup big.txt \| head` gets EPIPE on stdout and the tool panics. Handle `BrokenPipe` by exiting 0 quietly. |
| GT-5 | 13–14, 33–34 | COLOR WITHOUT TTY / `NO_COLOR` | 🟠 | Escape codes are emitted on stdout whenever `--color` is set, into files and pipes; `NO_COLOR` and `IsTerminal` are never consulted. Default to auto-detect, honour `NO_COLOR`. |
| GT-6 | 21     | CONFIG PRECEDENCE INVERTED | 🟠 | The env var `DEDUP_MODE` overrides the `--mode` flag; the rule is flags > env > file. Read env as the default, let the flag win (clap `env` attribute). |
| GT-7 | 15–16  | STRINGLY MODE, VALIDATED LATE | 🟠 | `mode: String` accepts anything and is compared to `"strict"` at the end; an invalid value is discovered after the work is done. A `ValueEnum` validates at parse time. |
| GT-8 | 11–16  | NO ARG HELP TEXT           | 🟡 | No doc comments on `input`, `--color`, `--mode` → `--help` says nothing about them. Add `///` help per arg. |

Pass = GT-1, GT-2, GT-4 and at least three of the others, with a `NEEDS WORK` verdict. A pass
that says "works, ship it" or misses the stdout contamination is the fail.
