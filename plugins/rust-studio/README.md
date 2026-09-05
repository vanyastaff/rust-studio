# Rust Code Studio

**Turn an agent session into a maintainer-grade Rust engineering studio.**
The portable skills install on Codex, Claude Code, and other Agent Skills hosts. Claude Code also
gets the tiered agent team, path-scoped standards, quality gates, and cargo-aware hooks.

> Inspired by the studio model of
> [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios),
> rebuilt from the ground up for Rust and packaged for Claude Code and Codex.

## In the box

- **62 skills** — design, spec-driven build, TDD, review, test, release, git/PR shipping,
  build-fixing, edition & major-dependency migration, CI gates, cross-session memory.
- **33 agents** — 2 directors → 7 leads → 20 specialists (including an adversarial
  `harsh-critic`) + a scout / builder / resolver / reviewer execution group.
- **20 path-scoped rule sets** — the right Rust standard surfaces the moment you open a matching
  file; the agent reads the full rule on demand, so the window stays lean.
- **12 Claude hook handlers across 8 events** — stack detection and memory recall, rule pointers, lint
  and lifecycle nudges, verdict checks, and an opt-in stop-guard.
- **Bundled rust-analyzer LSP** — diagnostics and go-to-definition as you edit, so `rust-scout`
  resolves symbols instead of scanning files. Just put `rust-analyzer` on PATH.
- **An integrity layer that rejects a gamed green** — see
  [What makes it different](#what-makes-it-different).

## Quick start

```text
/start            # detect the stack and route you
/dev-task <task>  # implement one unit of work: scout → plan → approve → build → review
/review           # audit your current diff against the gates
/team-api <api>   # design & ship a public API with the API team
```

## Before you start

Only one thing is genuinely required: a **Rust toolchain** via [rustup](https://rustup.rs), with
the `rustfmt` and `clippy` components. Agents run `cargo check / clippy / test / fmt` on almost
every task.

Two more turn features on rather than gate them: **`bun`** on PATH runs the hooks (rule
injection, memory recall, nudges) — without it they no-op and the studio still works — and
**`rust-analyzer`** on PATH activates the bundled LSP. The quality loop also reaches constantly
for three cargo tools:

```sh
cargo install cargo-nextest cargo-deny cargo-audit
```

Everything else is on demand: the skill that needs a tool names it and tells you how to install
it. Full table in [Requirements & tooling](#requirements--tooling); installing the plugin itself
is in [`../../INSTALL.md`](../../INSTALL.md).

## Skills (slash commands)

> Plugin commands are namespaced: `/rust-studio:<name>`.

- **Onboarding** — `/start` · `/help` · `/env-setup` (provision the machine: rustup + binstall + tool suite) · `/detect-stack` · `/adopt` · `/studio-doctor` (is the studio actually live here?)
- **Design** — `/brainstorm` · `/grill-me` (interview me to pull my input) · `/design-api` · `/architecture` · `/adr` · `/model-domain`
- **Build** — `/dev-task` · `/new-crate` · `/add-dep` · `/refactor` · `/migrate` (edition / major-dependency upgrade, with the semantic review `cargo fix` can't do) · `/fix-build` · `/ci-gate` (anti-hang / anti-silencing CI gate)
- **Spec-driven** — `/spec` · `/spec-tasks` · `/spec-verify` (persisted in `.rust-studio/specs/`)
- **TDD & verify** — `/tdd` · `/verify-loop`
- **Quality** — `/review` (`--full` = parallel multi-lens) · `/lint` · `/audit-unsafe` · `/perf` · `/bloat` (binary size) · `/security-audit` · `/deps-check` · `/api-review` · `/tech-debt` · `/scope-check`
- **Testing** — `/test-plan` · `/test-setup` · `/coverage` (what runs) · `/mutants` (what's checked) · `/fuzz` (inputs nobody imagined) · `/flaky-hunt`
- **Memory** — `/remember` · `/recall` · `/memory-doctor` · `/session-wrap` (cross-session, in the host's auto-memory store — no MCP, no vault)
- **Ship** — `/commit` · `/pr`
- **Release** — `/publish` · `/changelog` · `/msrv-check`
- **Teams** — `/team-api` · `/team-async` · `/team-perf` · `/team-release`

## If your project is a workspace

Most Rust projects become one, and two defaults stop fitting.

**Context.** A single root context file either bloats with every crate's conventions or stays too
generic. `/adopt` proposes per-crate files — showing which crates earned one and which it dropped,
so you strike individual crates rather than accept a block of thirty. Content goes in `AGENTS.md`
with a two-line `CLAUDE.md` beside it holding only `@AGENTS.md`: Claude Code reads `CLAUDE.md` and
not `AGENTS.md`, and only `CLAUDE.md` loads on demand as it walks subdirectories, while Codex,
Cursor and Copilot read `AGENTS.md`. A pointer holds no facts, so the two cannot drift.

**Commands.** A per-crate test command can lie to you:

```sh
cargo test -p my-crate                                # can be a FALSE GREEN
cargo nextest run --workspace -E 'package(my-crate)'  # what to trust
```

Features unify across the graph cargo actually builds, so a crate whose sibling enables a feature
on a shared dependency passes alone and fails under `--workspace` — and `--all-features` does not
close it, because it applies only to the selected package. What scopes safely and what lies, with
reproductions, is in [`docs/large-workspace.md`](docs/large-workspace.md), along with the
focus-scoping setup for large workspaces (`claudeMdExcludes`, `target/` read-denies, sparse
worktrees).

## The idea

Solo AI coding drifts: no boundaries, no review, no "are we sure?". This plugin imposes a
studio: specialists who own a domain, leads who hold quality gates, and one rule above all —

> **Question → Options → Decision → Draft → Approval** — run as a quality loop, autonomy-first:
> decide tactical calls and proceed; escalate only on strategic, irreversible, or outward steps.

See [`docs/coordination-protocol.md`](docs/coordination-protocol.md) for the full contract
— split into [`collaboration.md`](docs/collaboration.md) (autonomy, when to ask),
[`delegation.md`](docs/delegation.md) (tiers, teams, file writes) and
[`verdicts.md`](docs/verdicts.md) (gates, verdicts, evidence) — and
[`docs/agent-roster.md`](docs/agent-roster.md) for who owns what.

`docs/` and `rules/` are the single source of truth. Each skill carries a copy of what it
cites under `skills/<name>/references/`, so it stays self-contained when installed via
`npx skills add`. After editing canonical docs, helpers, or skill descriptions, run
`./scripts/sync-references.sh`, `node scripts/generate-openai-metadata.mjs`, and
`./scripts/validate-distribution.sh`; CI runs the validation plus the Bun test suite.

## The team

**Directors (inherit — session model)** — `chief-architect` (ARCH-GATE), `product-steward` (scope & sequencing).

**Leads (sonnet)** — `api-design-lead`, `async-systems-lead`, `cli-ux-lead`,
`systems-perf-lead`, `qa-lead`, `release-lead`, `tooling-lead`. Each owns a quality gate.

**Specialists (sonnet/haiku; judgment-heavy auditors inherit)** — API (`api-designer`, `error-architect`,
`macro-specialist`, `docs-engineer`), async/web (`async-runtime-specialist`,
`web-framework-specialist`, `database-specialist`, `observability-engineer`,
`wasm-specialist`), systems/perf (`concurrency-specialist`, `unsafe-auditor`,
`ffi-specialist`, `perf-engineer`, `embedded-specialist`), CLI (`cli-specialist`),
quality (`test-engineer`, `security-auditor`, `dependency-manager`, `build-engineer`), and a
cross-cutting adversarial `harsh-critic` (attacks designs/specs — challenges the premise, no praise).

**The hands** — `rust-scout` (locate, read-only) → `rust-builder` (implement) →
`rust-build-resolver` (get the build green) → `rust-reviewer` (audit & gate).

## Quality gates

`ARCH-GATE` · `API-GATE` · `ASYNC-GATE` · `CLI-GATE` · `PERF-GATE` · `SAFETY-GATE` ·
`QA-GATE` · `RELEASE-GATE` · `BUILD-GATE`. Run them at **full**, **lean**, or **solo**
intensity to match the work.

## Path-scoped standards

When you edit a file, a pointer to the matching standard (name + one-line summary + path) is
injected automatically; the agent reads the full rule on demand ([`rules/`](rules)):

| Edit a… | …and you get |
|---------|--------------|
| `*.rs` | core idiomatic-Rust standards |
| `src/lib.rs` | public-API & semver standards |
| handler/route/server file | async/service standards |
| `benches/**` | performance standards |
| `main.rs` / `bin/**` | CLI standards |
| `tests/**` | testing standards |
| `Cargo.toml` | manifest, dependency & workspace-lints hygiene |
| `build.rs` | build-script hygiene |
| domain/model/`error*.rs` | type-system, variance & error-taxonomy standards |
| `ffi*.rs` / `*-sys` crate | FFI / C-interop layout, ABI & unwind safety |
| macro crate (`*-macros`, `proc-macro*`) | `macro_rules!`/proc-macro hygiene & choice |
| handler/route/parser/auth file | security standards (untrusted-input boundary) |
| anything with `unsafe` | unsafe-code standards — UB catalog, `repr`, `&raw`, `MaybeUninit` |

## Hooks

- **SessionStart** — detects the crate/workspace, edition, MSRV, and domain; briefs the team, and
  recalls from the project memory store (the host's auto-memory directory): the notes that bind
  this work — title + kind/age + one-line hook + a direct path — ranked against the git branch /
  changed crates / last commit, plus index health (budget vs the host's 200-line / 25 KB load
  limit, index ↔ files). On Claude Code the host loads the index itself, so only pointers are
  added; on Codex the index rides along (`/recall` for the deliberate, verified pass).
- **PreToolUse (Read/Write/Edit/WebFetch)** — injects a compact *pointer* to each path-scoped
  Rust standard (name + one-line summary + absolute path) *before* you read or edit a matching
  file, so the agent knows which standards bind and reads the full rule on demand — instead of
  dumping every rule body into the window on every file (the dominant context cost, see
  `tools/context-cost.ts`). An edit that introduces `unsafe` also points to the unsafe-code
  standard. `core` leads every list; safety/security-critical rules are flagged ⚠️ REQUIRED.
  The same pass flags **provenance**: a read under a dependency root (`~/.cargo/registry`,
  `~/.cargo/git`, `vendor/`, `node_modules/`) or any web fetch is announced as third-party text
  with a pointer to [`docs/untrusted-context.md`](docs/untrusted-context.md) — once per session,
  not once per file.
- **UserPromptSubmit** — prompt-scoped recall: the prompt is matched against the memory index
  and a note that scores a strong hit is surfaced once per session (title, kind/age, path);
  plus a once-per-session nudge to `/recall` before working in a known area and to prefer a
  studio skill when one fits.
- **Stop** — nudges `/lint` if changed `.rs` files aren't rustfmt-clean.
- **Auto-capture (Stop)** — after a turn that finished a real unit of work (a completion summary +
  uncommitted changes) but saved nothing to memory, nudges you once to `/remember` any durable
  learning. Blocks the stop a single time and never re-blocks (`stop_hook_active` breaks the loop),
  so it's far gentler than Stop-guard. On by default (`auto_capture`); fails open.
- **SubagentStop** — a studio sub-agent that finishes without an explicit verdict
  (COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED) is stopped **once** and told to re-send its
  deliverable with the verdict and evidence appended; built-in agents and anything not on the
  roster are never touched, and a second stop always goes through.
- **PostModelSwitch** — when the session or a sub-agent changes model (a classifier fallback,
  `/model`), a two-sentence note says which model now judges the inherit-model gates and how to
  return; inside a sub-agent it asks for the model to be named next to the verdict's evidence.
- **PreCompact / SessionEnd** — remind you to persist an in-flight plan to a durable file and to
  run `/session-wrap` so learnings are captured to memory.
- **Stop-guard (opt-in)** — the mechanical teeth for the integrity doctrine: when `stop_guard` is
  on, it **blocks** the turn from ending (exit 2 → feedback to the model) if the final message
  dodges ownership, seeks permission, stops early, avoids tests, leaves stubs, hands the work back
  to you, or claims done without evidence. Off by default (it's aggressive); fails open — a stall
  allows the stop, never freezes the turn.

Hooks are TypeScript, run via [`bun`](https://bun.sh). If `bun` isn't on PATH they no-op — the
studio still works, you just lose auto-injection and recall. Each hook reads stdin behind a
hard timeout with a watchdog, so it can never freeze the session (even mid-subagent). See
[`../../INSTALL.md`](../../INSTALL.md).

## Configuration

The plugin prompts for these when you enable it (and you can change them anytime via `/plugin`
→ **Rust Code Studio** → configure).

> **On Codex**, which has no plugin-settings channel, set any option below through the
> environment instead: `RUST_STUDIO_<OPTION>` in upper case — `RUST_STUDIO_GATE_INTENSITY=lean`,
> `RUST_STUDIO_GIT_GUARD=off`. On Claude Code a configured value still wins over the variable.

**Behavior** — surfaced in the SessionStart briefing so the team honors them; `default_msrv`
also fills the MSRV line when a `Cargo.toml` doesn't declare one:

| Option | Default | Effect |
|--------|---------|--------|
| **Default test runner** (`test_runner`) | `nextest` | Test runner the studio prefers — set to `cargo` to skip cargo-nextest. |
| **Default gate intensity** (`gate_intensity`) | `full` | Default rigor for reviews & quality gates — `full` / `lean` / `solo`. |
| **House MSRV fallback** (`default_msrv`) | — | MSRV to assume when a crate doesn't pin `rust-version` (e.g. `1.82`). |

**Toggles** — turn off ambient behaviors that run automatically. Each is honored by its hook
(off = the hook no-ops); core behavior (stack briefing, path-scoped rule injection, sub-agent
verdict check) is always on, and the whole plugin disables with
`/plugin disable rust-studio@rust-studio`:

| Option | Default | Effect when off |
|--------|---------|-----------------|
| **Memory recall** (`memory_recall`) | on | No ranked pointers + index health at session start and no per-prompt pointers; the host still loads its index, and `/remember`, `/recall`, `/memory-doctor`, `/session-wrap` still work. |
| **Project memory directory** (`memory_dir`) | — | Moves the studio's memory off the host's auto-memory directory (Claude Code then no longer loads that index itself; the session-start hook carries it). Leave empty to share the host's store. |
| **Routing nudge** (`routing_nudge`) | on | Silences the once-per-session "prefer a skill / `/recall` first" prompt. |
| **Formatting nudge** (`fmt_nudge`) | on | Silences the Stop-hook nudge to `/lint` when changed `.rs` files aren't rustfmt-clean. |
| **Auto-capture learnings** (`auto_capture`) | on | No memory-capture nudge after a completed unit — capture stays manual (`/remember`, `/session-wrap`) and in-skill. |
| **Irreversible-action guard** (`git_guard`) | on | The agent may again run commands nothing can undo — `git reset --hard`, `clean -f`, `checkout .`, `branch -D`, `stash drop`, plain force-push, `reflog expire`, and a real `cargo publish`/`yank`. Plain `git push`, `--force-with-lease`, and `publish --dry-run` are never blocked either way. |
| **Progress visibility** (`progress_tracking`) | on | Orchestrating skills (`/dev-task`, `team-*`, `/refactor`, `/spec-verify`) stop keeping a live task list + per-phase result lines — phases run without the checklist narration. |

> LSP and any bundled MCP servers can't be toggled with a flag (they're declared statically) —
> remove `rust-analyzer` from PATH or disable the whole plugin to turn off the LSP.

**Stop-guard (opt-in enforcement)** — mechanical teeth for the integrity doctrine. Off by default
because it's aggressive (it can block legitimate stops). When on, the Stop hook returns exit 2 and
feeds the reason back to the model so it keeps working instead of ending the turn:

| Option | Default | Effect |
|--------|---------|--------|
| **Stop-guard** (`stop_guard`) | off | Block a turn ending whose final message dodges ownership, seeks permission, stops early, avoids tests, leaves stubs, hands work back, or claims done without evidence. |
| **Strict mode** (`stop_guard_strict`) | off | Also block on *soft* signals (speculation, weak completion, evidence-free claims) even when some evidence is present. |
| **Require evidence** (`stop_guard_require_evidence`) | off | Block any ending whose final message lacks concrete evidence (files changed / commands run / verification / result). |

Fine-tune via env: `STOP_GUARD_MIN_EVIDENCE` (default 2), `STOP_GUARD_MAX_HITS`, `STOP_GUARD_ALLOW_CATEGORIES` (comma-separated categories to exempt), `STOP_GUARD_DISABLED=1`.

**Terse review output style** — the plugin ships a `Rust review (terse)` output style
(one finding per line, severity-tagged, evidence over prose, verdict last). It is **opt-in**:
select it under `/config` → Output style. It keeps Claude's normal engineering behavior and only
changes how reviews are *reported*.

## Status line (live progress)

- **Per-sub-agent rows (automatic).** The plugin ships a `subagentStatusLine`, so each sub-agent
  in the agent panel below the prompt shows `● <type>: <description> · <elapsed> · <tokens>`
  (✓ done, ✗ error) instead of a bare name + token count. Renders in the Desktop app too. No setup.
- **Main bar (on by default).** Installed automatically into your `~/.claude/settings.json` on the
  first session (the `statusline` config; it never clobbers an existing `statusLine` and backs the
  file up). A plugin can't ship a top-level `statusLine`, hence the one-time auto-install. A two-line
  **Tokyo Night Powerline** bar with colored arrow segments and Nerd Font icons:

  ```
  line 1:  🦀 rust-studio · <project> · <branch ●dirty ↑↓> · PR #42 ✓ · <model> · think:<effort>
  line 2:  <ctx %> · 🔥 <burn>/min · ▸ <phase> <bar> n/total · 5h 24% · 1h58m · $<cost> · +A −R
  ```

  Truecolor Tokyo Night theme, fast cached git, and smart-hiding of empty segments; the context
  segment is colored by threshold; `▸ <phase>` / `✓ <tasks>` track the active orchestration via
  `.rust-studio/progress.json`. The **PR pill** carries the review state and is clickable (OSC 8);
  rate limits show the **countdown to reset**, not just a percentage. Anything only interesting when
  it goes wrong — a degraded prompt cache (with the harness's miss attribution), a limit about to
  bite, extra `/add-dir` scope — shares one **rotating alert slot** that stays empty while all is
  well. The bar reads `COLUMNS` and **adapts**: two rows at ≥120 columns, one row below that, with
  the least decisive segments dropped until the line fits. Icons are **emoji by default** (no
  special font needed); the powerline arrows + git branch glyph need a powerline-patched font.
  Env: `RUST_STUDIO_STATUSLINE_NERDFONT=1` (sleek FontAwesome icons, needs a Nerd Font) or `=0`
  (text labels) · `RUST_STUDIO_STATUSLINE_POWERLINE=0` (middot + rounded caps) ·
  `RUST_STUDIO_STATUSLINE_ASCII=1` · `NO_COLOR`.
  Manage with **`/progress-bar`**: `nerd` (FontAwesome — needs a Nerd Font) · `emoji` (default) ·
  `symbols` (plain Unicode ⌂ ◔ ↻ ⏱ — no font needed) · `text` (no icons) · `off` (remove) · or no
  arg to refresh after a plugin update.
  Set the `statusline` config off to skip the auto-install entirely.

## What makes it different

- **Anti-gaming integrity layer** — a doctrine ([`docs/integrity-and-evidence.md`](docs/integrity-and-evidence.md)) + always-injected rules + reviewer/QA gates that reject a *gamed green*: vacuous/tautological tests, stubs, weakened or `#[ignore]`-d tests, hidden denominators, lint-suppression escape hatches, and skipping the test-first/review discipline. Kept honest by an `/eval-agents` fixture (`rust-reviewer` catches 6/6 planted gaming defects)
- **The project's gate is the oracle** — a prescribed `cargo` command set reports on a hand-rolled build, not the one that governs merging, and it fails in both directions: `--all-features` silences lints that fire under the shipped default features, and a plain `nextest run` invents failures in a crate the repo's gate runs headless. The studio discovers the repo's own gate first — `justfile`, `Makefile`, `xtask`, cargo-make, lefthook, the CI lint/test job — runs *every* invocation it makes with its exact flags and env, and treats the cargo defaults as the fallback for a project that has none ([`docs/project-gate.md`](docs/project-gate.md)). A green from a command the merge gate does not run is an `Off-gate green` — an `INTEGRITY` finding, not a pass
- **Untrusted-context standard** — a Rust session reads a lot of text nobody on the project wrote (crate READMEs and `//!` docs, `docs.rs`, a dependency's `build.rs` output, PR threads, CI logs), and it all lands in the window looking like the agent's own reasoning. A doctrine ([`docs/untrusted-context.md`](docs/untrusted-context.md)) + a provenance pointer from the PreToolUse hook + `🚩 UNTRUSTED` findings in `rust-reviewer` / `security-auditor` / `dependency-manager` make third-party text **material to report on, never to act on**: a crate whose docs tell tooling to add a dep, ignore an advisory, or silence a lint is a `/add-dep` **block**, and Trojan-Source bidi codepoints in dependency source are a finding. Kept honest by the `security/untrusted-context` fixture, which scores whether the studio reports the planted instructions *and* still finds the two real defects they distract from
- **Claude 5 (Fable 5) ready** — judgment-heavy agents (directors, critic, reviewer, unsafe auditor) inherit the session model so gates never judge below the model that wrote the code; `security-auditor` stays pinned to Opus so a cyber-classifier trip falls back to Opus 4.8 inside the audit instead of switching the whole session; authoring rules keep prompts refusal-safe and non-prescriptive ([`docs/claude-5-compat.md`](docs/claude-5-compat.md))

### Script safety gate

A January-2026 scan of 31,132 marketplace skills found 26.1% carried at least one
vulnerability, and skills shipping executable scripts were **2.12x** more likely to have one —
and no publisher-trust mechanism exists for skills. This plugin ships hook scripts, build
scripts, and scripts bundled into skills, and to an installer it looks like every other plugin
in that scan. `scripts/validate-distribution.sh` — the same build-time check that gates every
release — includes a gate that fails if any shipped script matches one of four literal
patterns:

1. **Network from a hook.** `fetch(`, an `http(s)://` URL, `curl`, or `wget` anywhere in
   `hooks/scripts/*.ts` (excluding tests). Hooks run on every matching tool call with no prompt
   in the loop, so one that could reach the network could exfiltrate anything it reads.
2. **Dynamic code execution.** `eval(` or `new Function` anywhere in a hook, build, or
   skill-bundled script — the one primitive no static check can bound.
3. **`curl … | sh`.** Piping a download straight into an interpreter, anywhere except
   `scripts/env-setup.sh` — the single declared exception, a user-invoked installer that
   bootstraps rustup this way on purpose.
4. **Process spawning outside the shared helper.** Every hook is meant to spawn subprocesses
   through `hooks/scripts/_lib.ts`'s `run()`, which always sets a timeout so a stuck child can't
   hang the session. A raw spawn call outside it must still carry its own timeout, and if it
   builds the command by string interpolation it must additionally be an explicitly reviewed,
   named exception in the gate itself — today that's two calls in `memory-store.ts`, both
   passing only hardcoded literal `git` subcommands, never external or session-derived input.

**What this proves:** these four literal patterns are absent from shipped scripts today, and a
change that reintroduces one fails CI immediately, naming the file and line — so a property
that already holds can't quietly stop holding. **What this does not prove:** that any script is
free of other bugs, that no other means of reaching the network or spawning a process exists,
or that a skill's *prose* can't talk an agent into running something unsafe at your direction —
that last risk is what the untrusted-context doctrine
([`docs/untrusted-context.md`](docs/untrusted-context.md)) and `security-auditor` cover, not
this gate. For the product-wide security posture and how to report a vulnerability, see
[`../../SECURITY.md`](../../SECURITY.md).

## Requirements & tooling

> **Installing the plugin itself** (local marketplace, no GitHub remote needed) →
> [`../../INSTALL.md`](../../INSTALL.md).

### Required

- **Claude Code** with plugin support.
- **Rust toolchain** via [rustup](https://rustup.rs) — `cargo` + `rustc`, plus the `rustfmt`
  and `clippy` components (default with rustup; otherwise `rustup component add rustfmt clippy`).
  Agents run `cargo check / clippy / test / fmt` on almost every task.

### Recommended baseline

The core quality loop reaches for these constantly — install once:

```sh
cargo install cargo-nextest cargo-deny cargo-audit
```

- **`cargo-nextest`** — fast, isolated test runner (`/review`, `/test-*`, `/verify-loop`).
- **`cargo-deny`** — license / advisory / source policy (`/deps-check`, RELEASE-GATE).
- **`cargo-audit`** — RUSTSEC advisory scan (`/security-audit`).
- **`rust-analyzer`** on PATH — powers the **bundled LSP**: diagnostics (via `cargo clippy`) and
  go-to-definition after each edit. Absent → the LSP reports an error in the `/plugin` Errors tab
  and the studio falls back to file scanning.
  [Install](https://rust-analyzer.github.io/manual.html#installation).
- **`bun`** on PATH — runs the hooks (auto rule-injection, memory recall, lint nudge). Absent →
  hooks no-op safely and the studio still works. Install: see [`../../INSTALL.md`](../../INSTALL.md).

### On-demand (the skill that needs a tool names it and suggests the install)

| When you run… | Tools | Install |
|---|---|---|
| `/audit-unsafe`, any `unsafe` | `miri` (nightly), `cargo-careful` | `rustup +nightly component add miri` · `cargo install cargo-careful` |
| `/perf`, benchmarks | `cargo-flamegraph`, `samply`, `hyperfine`; `perf`/`valgrind` (Linux) | `cargo install flamegraph samply hyperfine` |
| `/api-review`, `/publish` | `cargo-public-api`, `cargo-semver-checks` | `cargo install cargo-public-api cargo-semver-checks` |
| `/msrv-check` | `cargo-msrv` | `cargo install cargo-msrv` |
| `/coverage` | `cargo-llvm-cov` (or `cargo-tarpaulin`) | `cargo install cargo-llvm-cov` |
| `/deps-check` | `cargo-hack`, `cargo-shear`, `cargo-hakari` (20+ crates) | `cargo binstall cargo-hack cargo-shear cargo-hakari` |
| macro crates | `cargo-expand` | `cargo install cargo-expand` |
| snapshot tests | `cargo-insta` | `cargo install cargo-insta` |
| mutation testing | `cargo-mutants` | `cargo install cargo-mutants` |
| FFI bindings | `bindgen` / `cbindgen` (+ system `libclang`) | `cargo install bindgen-cli cbindgen` |
| faster code navigation | `ripgrep` (`rg`), `fd`, `ast-grep` (`sg`) | `cargo install ripgrep fd-find ast-grep` |

**Not installed — these are crate `[dev-dependencies]`, written into your `Cargo.toml`, not your
`$PATH`:** `criterion` (benches), `loom` (lock-free model checking), `trybuild` (macro /
compile-fail tests), `insta` (snapshots).

**Platform notes:** `miri` needs a **nightly** toolchain; `perf` and `valgrind`/cachegrind are
Linux-only (macOS/Windows fall back to `samply`). Nothing here is hard-required — a missing tool
just makes the relevant skill report it's unavailable and point you at the install.

### Code intelligence (bundled)

- **rust-analyzer LSP ships with the plugin** ([`.lsp.json`](.lsp.json)). Install the
  [`rust-analyzer`](https://rust-analyzer.github.io/manual.html#installation) binary on PATH and
  it activates automatically — `rust-scout` resolves symbols via the language server instead of
  scanning files, and diagnostics (run through `cargo clippy`, matching the studio's zero-warning
  bar) surface after each edit. Missing binary → `Executable not found in $PATH` in the `/plugin`
  Errors tab and a graceful fall back to file scanning. For large multi-crate workspaces see
  [`docs/large-workspace.md`](docs/large-workspace.md) for the full focus-scoping setup (per-crate
  context files, `target/` read-denies, sparse worktrees) and the per-crate commands that lie —
  Anthropic's large-codebase guidance, mapped to Rust.

### Optional integrations

- **MCP servers**, used when present: a symbol-navigation server (serena) for `rust-scout` /
  `rust-builder` and a web-search server (exa) for advisory / freshness lookups. See
  [`docs/tooling.md`](docs/tooling.md#prerequisites--serena--exa-companions-not-bundled)
  for the install/register snippet. Cross-session memory needs no server — it is the host's
  auto-memory directory ([`docs/memory-protocol.md`](docs/memory-protocol.md)).

## License

MIT — see [LICENSE](LICENSE).

