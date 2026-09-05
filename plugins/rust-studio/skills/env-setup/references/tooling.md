# Tooling — prefer purpose-built tools over Bash search

Context is the studio's fundamental constraint (per Anthropic's
[best-practices](https://code.claude.com/docs/en/best-practices)): performance degrades as the
window fills. Semantic and purpose-built tools are faster, more precise, and far more
context-frugal than `grep`/`find`/`cat` in Bash. **Reach for the right tool; use Bash to run
things, not to search them.** All of these are *prefer-if-available* — fall back cleanly when a
tool isn't installed.

## Prerequisites — serena + exa (companions, not bundled)

The studio assumes these MCP servers are configured in your own Claude Code settings:

- **serena** — code navigation / language-server intelligence (symbol defs, refs, impls).
- **exa** — external evidence (real code examples, crates.io adoption, advisory/issue audits).

The plugin **intentionally does not bundle** these (no `mcpServers` in `plugin.json`): MCP
servers are loaded from the *user's* project/user settings, not from a plugin — and agent-team
**teammates** in particular only see the MCP you have configured ambiently, never a plugin's
bundled servers. So configure them once for yourself and every agent in the studio inherits them.

Install serena itself with `uv tool install -p 3.13 serena-agent`, then `serena init` (its README
is the source of truth for client wiring; it configures a launch command per client rather than
one universal setup command). Register servers with the host: `claude mcp add …` or your
`~/.claude.json` / project `.mcp.json` on Claude Code, `codex mcp add …` or `[mcp_servers.*]` in
`~/.codex/config.toml` on Codex — the studio ships neither, so both hosts need this once. See each
project's README — serena (`github.com/oraios/serena`) and exa
(`github.com/exa-labs/exa-mcp-server`). serena/exa are
*prefer-if-available*: every workflow falls back cleanly to `rg`/Glob for navigation and `gh`/web
for evidence, just less precisely.

**Project memory needs no server.** `/recall`, `/remember`, `/memory-doctor`, and the session-start / prompt hooks use the host's auto-memory directory for the repository through the harness's own Read/Write/Grep — the same `MEMORY.md` index Claude Code loads at session start, shared with Codex sessions. Contract and path rule: `memory-protocol.md`.

## Code navigation — semantic first
Prefer the **serena** MCP (a language server under the hood — the "code intelligence" the
official large-codebase guide recommends) for anything about symbols:

Tool names below are given **bare**. The harness prefixes them with the server name at load time
(`mcp__serena__find_symbol` for the `claude mcp add` path above); a differently-installed server
carries a different prefix, so match on the tool name, not the prefix.

| Need | Tool |
|------|------|
| Where is a type/trait/fn defined | `find_symbol` / `find_declaration` |
| Who calls / uses it | `find_referencing_symbols` |
| Who implements a trait | `find_implementations` |
| Overview of a file's/module's symbols | `get_symbols_overview` |
| Type hierarchy | `type_hierarchy` |
| Compiler diagnostics for a file | serena's diagnostics/inspections tool |
| Pattern across the project | the harness **Grep** tool (ripgrep) |
| Find a file / list a dir | the harness **Glob** / **Read** tools |

The last two rows are not a serena capability gap — `search_for_pattern`, `find_file`, `list_dir`
and `read_file` all exist. Serena's own README: "When Serena is used inside an agentic harness such
as Claude Code or Codex, these tools are typically disabled by default, since the surrounding
harness already provides overlapping file, search, and shell capabilities." So in *this* setting
they are usually absent — reach for the harness tool and do not wait on a serena call that will
not resolve.

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
- `mcp__exa__web_fetch_exa` — read a known page (docs.rs, release notes, a repo file) as
  clean markdown; the follow-up to a search hit.
- `mcp__exa__web_search_exa` — crates.io adoption, peer-project patterns, RUSTSEC advisories,
  upstream issue audits. (`gh` CLI for GitHub issues/PRs.)

## Cargo & Rust toolchain (by job)

**The project's gate outranks this table.** Where the repo owns a `justfile`, `Makefile`,
`xtask`, cargo-make target, lefthook hook, or a CI lint/test job, run *that* — with its feature
sets, env, and wrappers — and treat the rows below as the fallback for a project that has none.
A green under different flags is a green about a different build: `project-gate.md`.
| Job | Tool(s) |
|-----|---------|
| Run tests (fast, isolated) | `cargo nextest run` (fall back to `cargo test`); doc-tests via `cargo test --doc` |
| Coverage | `cargo llvm-cov` |
| Lints / format | the project's lint target if it has one; else `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt` |
| Security / advisories | `cargo audit`, `cargo deny check` |
| Semver / public API | `cargo semver-checks`, `cargo public-api` |
| Unused/misplaced deps | `cargo shear` (AST-based via rust-analyzer's parser; `--fix`; `--expand` on nightly for macro-heavy code) — `cargo machete` (regex, fast) / `cargo udeps` (nightly, compiler-based) as fallbacks |
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
