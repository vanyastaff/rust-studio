# Changelog

All notable changes to **Rust Code Studio** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.0] - 2026-06-16

### Added

- **`/grill-me`** — when a decision genuinely needs the user's input, the agent interviews them in
  **cheap, one-at-a-time questions, each with a recommended default**, instead of dropping a
  single heavy "what should we do long-term about X?" fork. Adapted from the grill-me productivity
  skill: it maps the decision tree first, tags each fork **DECIDE** (resolved by analysis / Rust
  best practice / reading the code via serena/`rust-scout`) vs **ASK** (answer truly lives in the
  user — taste, priority, risk appetite, breaking-change willingness), and only interviews on the
  ASK forks, in dependency order, until shared understanding — then hands off to `/spec` /
  `/architecture` / `/dev-task`. Verified on a caching-layer scenario: it collapsed a 5-dimensional
  heavy fork into 1 cheap question (2 worst-case), deciding 9/10 forks itself.

### Changed

- **Agents no longer offload their own analysis as a question.** Coordination Protocol §1 now
  forbids repackaging completed analysis as a heavy future-deciding fork that forces the user to
  reconstruct what the agent already worked out: if you've researched the area and have a
  defensible answer, that's a *tactical call* — decide it, state choice + rationale + reversibility,
  and let the user veto. A question is warranted only when the answer genuinely lives in the user,
  and then it must be **grill-me-shaped** — small, one-at-a-time, each with a recommended default
  and a "cost if wrong" — not a single multidimensional question the user must study to answer.
  Source the answer from the code (serena) before asking; it is often already there.

## [0.13.0] - 2026-06-16

### Changed

- **The quality bar is no longer a menu item.** Agents would sometimes ask via `AskUserQuestion`
  with a "fast / Quick Win (recommended) / full / reject" menu — offering substandard work as a
  selectable, even *recommended*, option, which directly contradicts the studio's own
  "no quick wins" standard (`integrity-and-evidence.md`). Coordination Protocol §1 now binds how
  options are built: **option sets vary by *scope* or *approach*, never by *quality*.** A
  "quick win / cut corners / skip tests / ship a shim / defer the ripple / TODO-it-later" choice
  is forbidden — least of all as the Recommended one. The Recommended option always clears the
  bar; if the user is time-pressured, the cut is to optional *scope*, not quality ("scope can be
  cut; the quality bar cannot"). Reinforced in `working-preferences.md` under *No quick wins*.
  Verified by spawning an orchestrator under the rule on a validation task that previously invited
  a quality menu — it returned a scope/approach option set with the bar-meeting option Recommended
  and the shortcut excluded.

## [0.12.0] - 2026-06-16

### Added

- **Self-documenting naming is now a first-class studio standard.** Previously the studio would
  often leave weak-but-valid identifiers (`x`, `tmp`, `data`, `mgr`, `timeout` with no unit,
  `fetch`/`get`/`load` for one concept) untouched, because clippy is silent on them and no rule
  gave agents a mandate to fix them. Naming is now woven through the whole pipeline:
  - **`rules/core.md`** gains a precise `## Naming (code documents itself)` section — names state
    intent, encode unit/domain (or use a newtype), use verb-phrase fns / noun types /
    question-form bools, ban domain-obscuring abbreviations, and converge on one word per concept.
    Choosing a clear name for code you write or touch is **part of the task, never scope creep**.
  - **`rust-reviewer`** flags intent-hiding names in its maintainer-shape audit as a 🟣 REDO
    finding — it is the gate clippy can't be, and must name the better identifier.
  - **`docs/maintainer-grade-development.md`** adds naming to the Maintainer Rejection Test and the
    Rust Design Bar, so leads/architects weigh it in the pre-code verdict.
  - **`rust-builder`** no longer reads "no out-of-task renames" as "don't improve names" — naming
    what you write/touch is part of the job, enforced by review rather than process.
  - **`/refactor`** Phase 2 now treats intent-hiding names as a first-class target independent of
    clippy, so "make this self-documenting" actually reaches the plan.
- **Eval fixture `naming/self-documenting`** (`/eval-agents naming`) — compiles clean and
  clippy-green but hides intent in 9 ways; guards that `rust-reviewer` returns **REDO-TO-BAR**
  instead of waving it through. Verified: 9/9 recall, correct reject verdict.

## [0.11.1] - 2026-06-16

### Added

- **`symbols` icon style** (`/progress-bar symbols`, `statusline.ts --icons symbols`) — plain
  Unicode glyphs (⌂ ◔ ↻ ⏱) that render in a normal monospace font, **no Nerd Font required**. A
  middle ground between emoji and Nerd Font icons.

## [0.11.0] - 2026-06-16

### Added

- **Switchable icon style** — `/progress-bar nerd | emoji | text | ascii` (backed by
  `statusline.ts --icons nerd|emoji|text` / `--ascii` / `--no-powerline` args, so the look is baked
  into the command with no env juggling). `nerd` = sleek FontAwesome icons (needs a Nerd Font
  installed in the terminal, e.g. "JetBrainsMono Nerd Font"); `emoji` (default) renders without any
  special font; `text` drops decorative icons. The 🦀 tag and the powerline branch glyph/arrows are
  kept in every mode.

## [0.10.1] - 2026-06-16

### Changed

- **Calmer Tokyo Night palette.** Only two segments carry a colored background now — the 🦀 tag and
  the context segment (by threshold). Every other segment is colored **text** on a dark background
  (git, model, phase, …) — less rainbow, more Tokyo Night.

### Fixed

- **Icons render without a full Nerd Font.** Decorative icons default to **emoji** (📁 📊 💾 🕐),
  which render in normal terminals — previously they used FontAwesome (F0xx) glyphs that showed as
  tofu unless a Nerd Font was installed (only the powerline branch glyph rendered). The powerline
  branch glyph + arrows (E0xx) are kept. Opt into sleek FontAwesome icons with
  `RUST_STUDIO_STATUSLINE_NERDFONT=1` (needs a Nerd Font); `=0` uses text labels.

## [0.10.0] - 2026-06-16

### Changed

- **Status line redesign — Tokyo Night + Powerline + Nerd Font icons** (the new default look). A
  two-line powerline bar with colored arrow caps, a Tokyo Night truecolor palette, and icons
  (branch, folder, gauge, clock). The context segment is colored by threshold
  (green → yellow → red); same-background segments are divided by a thin powerline separator. The
  project name comes from the repo root (`project_dir`), not the current subdirectory. Fallbacks via
  env: `RUST_STUDIO_STATUSLINE_NERDFONT=0` (text labels, no glyph icons),
  `RUST_STUDIO_STATUSLINE_POWERLINE=0` (middot separators + rounded caps),
  `RUST_STUDIO_STATUSLINE_ASCII=1`, `NO_COLOR`.

### Fixed

- The context segment no longer renders an illegible block bar on its colored powerline background —
  it shows just the percentage (the no-powerline fallback keeps the bar).

## [0.9.1] - 2026-06-16

### Fixed

- The status line's **`🦀 rust-studio` tag now shows in every directory**, not only Rust projects —
  so it's visible while working in the plugin repo itself (no root `Cargo.toml`) and in any other
  repo. The `lsp ✓` segment stays Rust-only. (Earlier gating hid the bar's identity exactly where
  the author was testing it.)

## [0.9.0] - 2026-06-15

### Added

- **The main status line is now ON BY DEFAULT.** A SessionStart hook installs the rich `statusLine`
  into `~/.claude/settings.json` once (the `statusline` config, default on) — a plugin cannot ship a
  top-level `statusLine` itself. It **never clobbers an existing `statusLine`**, backs settings up
  first, refuses to touch a malformed settings file, and is one-time (a marker prevents re-edits).
  The studio "🦀 rust-studio" tag shows only in Rust projects; elsewhere the bar degrades to
  project · git · model · ctx. Manage/remove with `/progress-bar`. (Per-sub-agent rows were already
  on by default.)

### Changed

- **Rich main status line.** `/progress-bar`'s `statusLine` is now a two-line rounded bar with a
  truecolor gradient (→256→16→none; `NO_COLOR` honored), ASCII / powerline env toggles
  (`RUST_STUDIO_STATUSLINE_ASCII`, `RUST_STUDIO_STATUSLINE_POWERLINE`), and fast git cached ~5s:
  ```
  ╭─ 🦀 rust-studio · <project> · <branch ●dirty ↑ahead ↓behind> · <model> · think:<effort> · lsp ✓
  ╰─ ctx <bar> % · cache % · ▸ <phase> <bar> n/total · ✓ <tasks> · 5h/7d · <dur> · +A −R
  ```
  The model's context suffix (`(1M context)` / `[1m]`) is stripped; prompt **cache-hit %** and
  **reasoning effort** (`think:<level>`) are shown; empty/zero segments are smart-hidden. Inspired by
  ccstatusline / claude-powerline / pi-lens.
- `progress.ts` now takes flags — `set --phase <p> [--step n/total] [--tasks n/total] [--note ..]` —
  and records a task count for the `✓ <tasks>` segment.

### Notes

- A pi-lens-style diagnostics segment (`●E ▲W` from cargo/clippy) was scoped and **deferred**: Rust
  has no cheap incremental diagnostics CLI, so it needs a debounced PostToolUse check-runner writing
  `.rust-studio/diag.json` — expensive on large projects. Layout presets were deferred too.

## [0.8.0] - 2026-06-15

### Added

- **Live sub-agent status rows (zero-config).** The plugin ships a `subagentStatusLine` (in its
  `settings.json`) that renders each sub-agent row in the agent panel as
  `● <type>: <description>  ·  <elapsed> · <tokens>` (✓ when done, ✗ on error) — so a running
  fan-out reads as live progress instead of a bare name + token count. Renders in the Desktop app
  too. No setup required.
- **`/progress-bar` skill (opt-in main status bar).** Wires an optional `statusLine` into your
  `~/.claude/settings.json`: `🦀 rust-studio · <project> · ▸ <phase> · <model> · ctx %`. The
  `▸ <phase>` segment tracks the live orchestration phase via `.rust-studio/progress.json`.
  `/progress-bar off` removes it. (A plugin cannot ship a top-level `statusLine`, so this edits
  user settings; re-run after a plugin update.)
- New scripts (with tests): `scripts/subagent-statusline.ts`, `scripts/statusline.ts`,
  `scripts/progress.ts`.

### Changed

- **Two-stage review in `/dev-task`** (adopted from the superpowers subagent-driven-development
  pattern): Phase 5 now runs **spec-compliance first, then code-quality**, each looping back to
  `rust-builder` on findings; a `COMPLETE` verdict requires both stages to pass.
- Orchestrating skills mirror the current phase to the status bar via `scripts/progress.ts` when
  `progress_tracking` is on.

## [0.7.1] - 2026-06-15

### Changed

- Hook robustness, aligned with current Claude Code hook inputs (verified against the
  changelog): `subagent-stop` now reads the sub-agent's own transcript via the
  `agent_transcript_path` hook input (≥ 2.0.42), falling back to resolving it from the
  parent session's `subagents/` directory on older versions. `auto-capture` now prefers
  the authoritative `last_assistant_message` hook input (≥ 2.1.47) over re-parsing the
  transcript tail (with the transcript still read for the in-turn capture-signal scan).
  No user-facing behavior change.

## [0.7.0] - 2026-06-15

### Added

- **Progress visibility (`progress_tracking`, on by default).** Orchestrating skills —
  `/dev-task`, `/team-api`, `/team-async`, `/team-perf`, `/team-release`, `/refactor`, and
  `/spec-verify` — now keep a **live task list** (one task per phase) and surface each phase's
  result as it completes, in both team and single-orchestrator mode. You follow
  scout → plan → build → review on the task list instead of waiting in silence until the end —
  intermediate results, not one final dump. Reads in skills via `${user_config.progress_tracking}`
  and is shown in the SessionStart briefing (`Studio config: … · progress on`).

## [0.6.0] - 2026-06-15

### Added

- **Automatic memory capture.** A new `auto_capture` Stop hook (on by default) nudges the
  agent once, after a turn that finished a real unit of work (a completion summary +
  uncommitted changes) without saving anything, to `/remember` any non-obvious, durable
  learning. It blocks the stop a single time and never re-blocks (`stop_hook_active` breaks
  the loop), so it is far gentler than `stop_guard`. Fails open — a stall allows the stop.
- **In-skill capture (Tier 1).** `/dev-task` (Phase 6), `/verify-loop`, `/debug`, and
  `/refactor` now run `/remember` for durable learnings as part of their close; `/spec-verify`'s
  capture hint became an explicit action. Capture now fires from the work loop, not only at
  session end.
- **Domain-aware session-start routing.** The SessionStart briefing maps the detected domain to
  the fitting entry skill (async/web → `/team-async`/`/design-api`, systems/embedded →
  `/team-perf`/`/audit-unsafe`, cli → `/dev-task`, library → `/design-api`/`/team-api`) instead
  of emitting a static list. Universal fallbacks (`/dev-task`, `/review`, `/help`) are still
  surfaced.
- **Write-to-memory criteria for the `memory: project` agents** (`chief-architect`,
  `unsafe-auditor`, `security-auditor`): they now record durable findings to project memory and
  surface a `MEMORY:` line so the orchestrator can `/remember` them into the shared vault.

### Changed

- `/dev-task`'s closing next-step suggestion now includes `/session-wrap`; `/lint` and
  `/ci-gate` now end with a concrete next command.
- `docs/usage-guide.md` and `README.md` document the two memory layers (the shared Obsidian
  vault used by `/remember` / `/recall` / session-start recall, vs. the per-agent
  `memory: project` store) and the new `auto_capture` toggle.

### Notes

- A raw-inbox capture tier on PreCompact/SessionEnd (writing an uncurated drop when the agent
  is unreachable and context is about to evaporate) was scoped and deferred.
