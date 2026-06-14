# Tooling — prefer purpose-built tools over Bash search

Context is the studio's fundamental constraint (per Anthropic's
[best-practices](https://code.claude.com/docs/en/best-practices)): performance degrades as the
window fills. Semantic and purpose-built tools are faster, more precise, and far more
context-frugal than `grep`/`find`/`cat` in Bash. **Reach for the right tool; use Bash to run
things, not to search them.** All of these are *prefer-if-available* — fall back cleanly when a
tool isn't installed.

## Code navigation — semantic first
Prefer the **serena** MCP (a language server under the hood — the "code intelligence" the
official large-codebase guide recommends) for anything about symbols:

| Need | Tool |
|------|------|
| Where is a type/trait/fn defined | `mcp__plugin_serena_serena__find_symbol` / `find_declaration` |
| Who calls / uses it | `mcp__plugin_serena_serena__find_referencing_symbols` |
| Who implements a trait | `mcp__plugin_serena_serena__find_implementations` |
| Overview of a file's/module's symbols | `mcp__plugin_serena_serena__get_symbols_overview` |
| Pattern across the project | `mcp__plugin_serena_serena__search_for_pattern` |
| Compiler diagnostics for a file | `mcp__plugin_serena_serena__get_diagnostics_for_file` |
| Find a file / list a dir | `mcp__plugin_serena_serena__find_file` / `list_dir` |

Serena resolves through the parse/type layer, so it finds real defs/refs that text search
misses and skips the false hits text search invents. Use **`rg`** to confirm and to catch
macro-generated / `cfg`-gated sites serena can't see.

## Text & structural search, files
- **`rg` (ripgrep)** for text — never `grep`. The harness **Grep** tool is ripgrep; prefer it.
- **Glob** (harness) or **`fd`** for finding files — never `find`.
- **`ast-grep` / `sg`** for **structural** search and **mass rewrites** (AST-aware rename /
  refactor across the tree) — the right tool for "rename this everywhere" and pattern-based
  transforms, far safer than regex on Rust source.

## External evidence & prior art
Decisions want data, not opinion (`working-preferences.md`). Use the **exa** MCP:
- `mcp__exa__get_code_context_exa` — real code examples / docs for a crate or API.
- `mcp__exa__web_search_exa` — crates.io adoption, peer-project patterns, RUSTSEC advisories,
  upstream issue audits. (`gh` CLI for GitHub issues/PRs.)

## Cargo & Rust toolchain (by job)
| Job | Tool(s) |
|-----|---------|
| Run tests (fast, isolated) | `cargo nextest run` (fall back to `cargo test`); doc-tests via `cargo test --doc` |
| Coverage | `cargo llvm-cov` |
| Lints / format | `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt` |
| Security / advisories | `cargo audit`, `cargo deny check` |
| Semver / public API | `cargo semver-checks`, `cargo public-api` |
| Unused deps | `cargo machete` (fast) or `cargo udeps` (nightly, thorough) |
| Feature-combo build matrix | `cargo hack` |
| Unsafe / UB | `cargo +nightly miri test`, `cargo careful` |
| Macro expansion | `cargo expand` |
| Perf: profile / bench / compare | `cargo flamegraph`, `samply`, `criterion`, `hyperfine` |
| Module tree | `cargo modules` |
| Watch loop | `bacon` |
| LOC / size | `tokei` |
| Readable diffs | `delta` (or `git diff`) |

## Rule
Never use Bash `grep`/`find`/`cat`/`sed`/`awk` for searching or navigating code when a
dedicated tool fits. Bash runs `cargo`/`git`/tools and orchestrates; serena/rg/ast-grep/Glob
search; exa researches. This keeps reads out of context and answers precise.
