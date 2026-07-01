# Changelog

All notable changes to **Rust Code Studio** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.28.0] - 2026-07-01

### Added

- **New `/env-setup` skill + `scripts/env-setup.sh`** — provision a development machine
  end-to-end: OS build prerequisites per platform (dnf/apt/pacman/zypper/apk/brew), latest
  stable Rust via rustup with the components the studio needs (`clippy`, `rustfmt`,
  `rust-analyzer`, `rust-src`, `llvm-tools-preview`), `cargo-binstall`, and the studio's
  cargo tool suite installed as **prebuilt binaries** in tiers (core / deep-quality+perf /
  QoL), aligned with the `docs/tooling.md` canon. The mechanical work lives in one
  idempotent, root-refusing bash script (`--check` / `--core` / `--full` / `--qol` /
  `--nightly` / `--os-deps` / `--yes` / `--dry-run`) — also usable standalone — and the
  skill orchestrates: detect → scope gate → run script → verify by re-probed `--version`
  output (non-zero exit = something still missing). Optional skill-driven extras:
  nightly+miri, mold linker and sccache `~/.cargo/config.toml` merges. Listed under
  Onboarding in `/help`, the README, and the usage guide.

### Changed

- **Unused-dep canon: `cargo-machete` → `cargo-shear`.** shear parses imports with
  rust-analyzer's parser instead of regex, also catches *misplaced* deps (dev/build in the
  wrong section) and unlinked source files, ships `--fix` / `--deny-warnings` /
  `--format=json`, and auto-recognizes cargo-hakari `workspace-hack` crates. machete and
  `cargo-udeps` stay documented as fallbacks. Updated: `docs/tooling.md`,
  `docs/ci-best-practices.md`, `dependency-manager` agent, `/deps-check`, the README tool
  table, and the `/env-setup` core tier.
- **`/env-setup` full tier grew the tools the studio already references but never
  installed:** `cargo-llvm-lines` (`/bloat` monomorphization pass), `cargo-insta`
  (snapshot review CLI for `/test-setup`), `cargo-hakari` (20+-crate workspaces).
- **`/env-setup --memory`** installs the studio's memory stack: `obsidian-mcp` built with
  `--features embeddings` (`cargo install` — the one deliberate compile-from-source, since
  prebuilt binaries don't carry the feature), then prints the user-scope
  `claude mcp add obsidian …` registration line. The `--check` report now shows the
  memory server's presence alongside rustup/binstall.

## [0.27.0] - 2026-07-01

### Changed (Claude 5 / Fable 5 readiness — from Anthropic's official Fable 5 prompting & migration guidance)

- **Judgment-heavy agents now inherit the session model.** `chief-architect`,
  `product-steward`, `harsh-critic`, `rust-reviewer`, and `unsafe-auditor` switch from
  `model: opus` to `model: inherit` — a gate should never judge below the model that wrote
  the code. On a Claude 5 session the gates get Fable 5, whose code-review recall exceeds
  Opus 4.8; on an Opus session nothing changes. Specialists stay `sonnet`, the scout `haiku`.
- **`security-auditor` stays deliberately pinned to `opus`.** Fable 5's cyber safety
  classifiers screen exactly the content a vulnerability audit produces; a mid-audit refusal
  would silently weaken the RELEASE-GATE. Opus 4.8 runs the same audit refusal-free. This
  also keeps `/eval-agents` security-fixture scoring stable.
- **New `docs/claude-5-compat.md`** — what changed with the Claude 5 family (always-on
  adaptive thinking, effort default flipped to `high`, refusal classifiers, higher review
  recall, more dependable parallel subagents) and how the studio responds, with links to the
  official docs. Includes the verified Claude Code classifier mechanics (interactive = auto
  fallback to Opus with a sticky session swap, headless = refusal; first-request workspace
  context can trip it — relevant to the planted-vulnerability benchmark fixtures, with
  `claude --safe-mode` as the diagnostic) and a periodic self-audit prompt for finding
  weaker-model guardrails and drift in the studio's own instruction layer.
- **Agent authoring rules hardened for Claude 5** (`docs/agent-template.md`): never instruct
  an agent to echo/transcribe its reasoning (trips the `reasoning_extraction` refusal
  classifier — full-plugin audit found zero occurrences today); encode judgment, not
  scripts — Anthropic reports over-prescriptive step lists degrade Fable 5 output.
- Roster, usage guide, coordination protocol, `/team-perf`, and README updated to reflect
  the model policy.

### Changed (from a three-way audit of agents, skills, and hooks against the Fable 5 guidance)

- **Stale exa tool name fixed everywhere.** 5 skills, 5 agents, and `docs/tooling.md`
  instructed calls to `get_code_context_exa`, which the current exa MCP no longer exposes —
  on Fable 5 an invitation to attempt a nonexistent tool. Renamed to the real
  `web_fetch_exa` (paired with `web_search_exa`); the optional crate-docs MCPs
  (cratesio/context7/rust-docs) named in 4 skills now carry the "if one is configured"
  hedge the coordination protocol already used.
- **`/team-async` test gate aligned with `/dev-task`.** Its builder instruction said
  "test-driven where practical" — the exact hedge dev-task forbids; now red→green is
  required for any behavior change, same wording as the rest of the studio.
- **stop-guard recalibrated for Claude 5** (opt-in hook): `permission-seeking` and
  `premature-stopping` demoted from hard to soft — Fable 5 asks far less, and the asks
  that remain are disproportionately the legitimate strategic/irreversible forks the
  protocol itself says to escalate (a hard block was shoving the model past them);
  "i can't/cannot verify"/"unable to verify" moved from hard `test-avoidance` to soft
  `untested-mention` so an honest, evidenced impossibility report isn't punished.
  Evidence-free occurrences of all three still block. Hook tests: 99 → 101, all passing.
- **De-duplicated the judgment agents** (they now run at the session model, where repeated
  scaffolding costs more than it helps): `unsafe-auditor`'s "You own" no longer restates the
  full UB checklist that "How you work" owns, its "≥20 lines of context" micro-instruction is
  gone, and the 🟡 MINIMIZATION vs REDO-TO-BAR boundary is defined (blocker only when the
  diff introduced the avoidable unsafe); `rust-reviewer` states the integrity taxonomy and
  the "green is the floor" formula once instead of four times and points its command list at
  step 7; `chief-architect` drops the generic understand-the-goal/identify-the-decision steps
  and the textbook halves of the SOLID bullets (the studio rulings stay); `product-steward`
  and coordination-protocol §1/§5 lose their duplicated escalation/verdict restatements.
- **Personal name removed from shipped prompts** (`keep plugin universal`): "vanya's bar" /
  "vanya rejects" in `rust-reviewer`, `harsh-critic`, and `working-preferences.md` are now
  "the studio".
- **Edited review agents re-validated with `/eval-agents`** (both on Fable 5 via
  `model: inherit`): `rust-reviewer` 34/34 planted defects across 8 fixtures with all
  first-pass-bar reject verdicts, `unsafe-auditor` 7/7 across 2 fixtures with miri named —
  100% recall, no noise. One fixture premise had drifted, not an agent gap:
  `modern-rust/stale-idiom` claims "compiles on a current toolchain", but on edition 2024
  its `static mut` shared reference is a deny-by-default hard error (`static_mut_refs`) —
  ground truth now also accepts NEEDS WORK backed by rustc output, with all three rows
  still required.

## [0.26.0] - 2026-07-01

### Fixed (hooks — from a full audit of all 12 scripts, tests run)

- **Timed-out checks no longer read as failures.** `_lib.ts run()` mapped a
  timeout-killed child (`exitCode: null` + signal) to exit code 1 — so on any workspace
  where `cargo fmt --all --check` exceeded its budget, the fmt nudge fired on **every
  stop** claiming files weren't rustfmt-clean. `run()` now returns `null` ("couldn't
  check, stay silent") on timeout/signal, with a regression test.
- **`inject-rules` is now import-safe and matches relative dir globs.** The script ran
  its main flow at import time (importing it for tests exited the host process); it is
  now guarded by `import.meta.main`. A relative glob with a slash (`src/**/*.rs`) was
  `^`-anchored and could never match an absolute tool path — now retried anchored
  anywhere (latent: all shipped rules start with `**/`; it bit user-authored rules).
- **Watchdog gaps closed.** `session-start`, `fmt-check`, and `session-end` disarmed
  their watchdog after stdin — leaving the slow part (git calls, vault walk, cargo)
  unguarded; a stall handed the whole hook to the harness's kill. Watchdogs now stay
  armed for the entire run (fail-open exit 0) with budgets trimmed to fit.
- **Session-state keys no longer pool across id-less sessions.** stop-guard,
  auto-capture, inject-rules, and the routing nudge keyed tmp state on a shared
  `"unknown"`/`"nosession"` constant when `session_id` was absent — the auto-capture
  budget was then never reset (permanently un-nudged after 2 nudges ever) and rule
  injection was suppressed for every later id-less session. Now keyed by
  `transcript_path` fallback or skipped entirely, failing toward the useful behavior.
- **A stop-guard block no longer starves the capture nudge.** auto-capture exited
  unconditionally on `stop_hook_active` — but that flag is also set when *stop-guard*
  blocked, so any turn stop-guard fired on silently lost its memory-capture check.
  auto-capture now stands down only when its *own* recent nudge caused the continuation.
- **SubagentStop misc.** Parallel subagents finishing within 5s can't be attributed to
  a transcript — the hook now fails open instead of judging agent A against agent B's
  file; the parent-transcript fallback reads a bounded 2MB tail instead of the whole
  session JSONL; `harsh-critic`'s prescribed verdicts (SURVIVES / DOESN'T SURVIVE /
  INSUFFICIENT INFO) are now in the verdict regex, so the hook stops nagging it on
  every run (regression-tested).
- **stop-guard: "untested"/"not tested" demoted to a soft category** — they are
  legitimate REVIEW findings ("the error path is untested"); hard-blocking punished
  honest review deliverables. With evidence they pass; evidence-free they still block.
- **Memory-protocol alignment.** session-start's recall no longer groups by
  `decisions/planning/specs` subfolders the flat vault layout doesn't have (which
  silently capped matched notes at 4 — now a pure ranked top-8) and its orient text +
  auto-capture's nudge both point at `docs/memory-protocol.md` as the canonical rule.
- New toggles: `lifecycle_notes` (pre-compaction warning + session-end reminder);
  `stop_guard_allow_categories` is now declared in the manifest. `pluginRoot()` handles
  install paths containing spaces. Hook test suite: 90 → 99 tests, all passing.

### Changed (agents — from a full audit of all 33 definitions)

- **Verdict discipline aligned with protocol §5.** The 11 agents that judge work
  (directors, leads, both auditors) now carry the four-verdict set including
  **REDO-TO-BAR**; `perf-engineer` used plan-review vocabulary (RESHAPE NEEDED) as a
  final verdict — fixed; `docs/agent-template.md` no longer seeds the stale 3-verdict
  set.
- **Memory convention completed.** memory-protocol.md promised the `MEMORY:` line from
  all reviewers/critics/specialists-with-decisions; 9 more agents now deliver it
  (rust-reviewer, harsh-critic, rust-build-resolver, api-designer, dependency-manager,
  database-specialist, concurrency-specialist, ffi-specialist, macro-specialist) — 22
  agents total.
- **Dangling references removed.** `search_for_pattern` (a serena tool the pinned build
  doesn't expose) purged from 15 agents, 7 skills, and tooling.md in favor of harness
  Grep; product-steward's `team-review` skill reference fixed; rust-build-resolver's
  `cratesio/context7/rust-docs` MCP advice made conditional on the user having one
  configured (also in coordination-protocol §0).
- **SCOPE-GATE formally registered** (owner: product-steward — diff/plan vs acceptance
  criteria) in the §4 gate table and roster; product-steward's output is now an
  evidence-backed story/scope table, never a verdict-only reply.
- **Weakest agents strengthened.** web-framework-specialist (security.md standard,
  ASYNC-GATE contribution, maintainer-grade ref); docs-engineer (core.md +
  working-preferences refs, explicit API-GATE/RELEASE-GATE sign-off checklists).
- **Docs de-drifted.** rust-reviewer is opus everywhere (roster ×2, protocol §2, usage
  guide); docs-engineer/wasm-specialist/dependency-manager tier claims aligned to
  frontmatter (sonnet); harsh-critic and rust-build-resolver added to the org chart and
  §2 ("Execution trio" → Execution (4)); routing rows for adversarial review and test
  strategy added.

## [0.25.0] - 2026-07-01

### Added

- **`docs/memory-protocol.md` — the canonical second-brain contract.** One doc now owns
  when/who/what for cross-session memory: the layer map (session-start recall, `/recall`,
  `/remember`, `MEMORY:` verdict lines, auto-capture, `/session-wrap`), the canonical
  what-to-capture rule (all other restatements are one-line echoes that defer to it), the
  recall-before / remember-after patterns skills encode, and the single-writer contract
  (the orchestrator persists; agents only emit `MEMORY:` lines). Coordination protocol
  gains a §9 pointer; `/help` and the usage guide link it.
- **Recall-before / remember-after woven through 21 skills.** Before this pass exactly
  one skill (`/spec`) recalled before working; now every skill that plans, designs,
  debugs, or builds in a known area starts with `/recall <area>` and closes by sweeping
  agent verdicts for `MEMORY:` lines + persisting what settled (or stating "nothing
  durable"): `dev-task`, `debug`, `refactor`, `architecture`, `adr`, `design-api`,
  `perf`, `tdd`, `flaky-hunt`, `fix-build`, `resolve-pr`, `brainstorm`, the four
  `team-*` orchestrators (which now paste recalled context INTO team spawn prompts —
  teammates don't inherit session context), and the new `fuzz`/`mutants`/`bloat`.
  `/adopt` now seeds the vault at onboarding (inferred conventions, domain map, top
  gotchas) instead of leaving memory empty.
- **`MEMORY:` verdict lines on 10 more agents.** The convention existed on only the three
  `memory: project` agents; now every decision-making lead (`api-design-lead`,
  `async-systems-lead`, `systems-perf-lead`, `qa-lead`, `cli-ux-lead`, `tooling-lead`,
  `release-lead`, `product-steward`, `error-architect`) surfaces durable decisions for
  the orchestrator to persist, and `rust-scout` reads recalled notes before re-deriving
  a map (flagging code-vs-decision drift).

### Fixed

- **`/security-audit` and `/audit-unsafe` now persist their agents' `MEMORY:` lines.**
  `security-auditor`/`unsafe-auditor` are read-only and surfaced durable triage
  (RUSTSEC waivers, accepted invariants, false positives) on `MEMORY:` lines that no
  skill ever harvested — the emit side existed, the persist side didn't.
- **Worktree path divergence between recall and remember.** The session-start hook
  resolves the vault project folder from the **main worktree root**, but `/remember` and
  `/recall` used the raw cwd basename — so a git-worktree session read one project
  folder and wrote another. Both skills now resolve via `git rev-parse
  --git-common-dir`, matching the hook.
- **Dangling protocol pointer in `/recall`** (cited `coordination-protocol.md`, which had
  no memory section) now points at `memory-protocol.md`.
- **Personal project names removed from the plugin — fully universal.** Benchmark
  fixtures used `nebula-*` crate names and `directory-conventions.md` named
  nebula/surge/flui-scale; fixtures now use `acme-*` and docs use neutral wording.
  Stale counts corrected (54 skills, 20 rules).

## [0.24.0] - 2026-07-01

### Added

- **`/fuzz` — coverage-guided fuzzing, crash to regression test.** Sets up `cargo-fuzz`,
  ranks fuzz surfaces by risk (untrusted-input parsers, `unsafe` boundaries, custom
  `Deserialize`, stateful APIs), writes property-asserting targets with seeded corpora,
  runs a bounded campaign, and triages every crash: minimize (`tmin`) → classify (UB goes
  to `unsafe-auditor`) → root-cause → fix via `rust-builder` **with a committed `#[test]`
  regression** (corpus files don't run in CI). Offers CI wiring via `build-engineer`.
  Closes the studio's biggest testing gap — nothing covered the inputs nobody wrote a
  test for.
- **`/mutants` — mutation testing with `cargo-mutants`.** Coverage says a line *ran*;
  mutation testing says a bug on it would be *caught*. Runs a scoped, cost-estimated
  pass (`--list` first, `--in-diff` suggested for CI), ranks missed mutants by
  behavioral risk (error-path swaps, boundary arithmetic, match-arm deletions over
  formatting noise), drafts the minimal killing assertion with `qa-lead`, and verifies
  each fix by re-running the exact mutant — missed → caught is the acceptance criterion.
- **`/bloat` — binary-size audit with the `/perf` discipline (measure → cut → prove in
  bytes).** Baselines the real artifact (gzipped for wasm, `cargo size` for embedded),
  checks profile wins first (`strip`, LTO, `codegen-units`, `panic`), attributes bytes
  with `cargo bloat` / `cargo llvm-lines` / `twiggy`, then cuts one change at a time with
  re-measurement — a cut that saves nothing gets reverted. Confirms dep removals actually
  left the binary (feature unification), and offers a CI size-regression check.
- The three skills form an explicit testing triad, cross-linked from `/coverage`,
  `/test-plan`, `/security-audit`, `/audit-unsafe`, and `/perf`: coverage = what runs,
  mutants = what's checked, fuzz = what nobody imagined.

## [0.23.0] - 2026-06-30

### Added

- **Plan-review gate in `/dev-task` — adversarial review of the plan BEFORE any code is
  written.** New **Phase 2.5** between Plan and Approve: an *independent* reviewer attacks the
  plan (wrong/oversized decomposition, a simpler approach missed, unhandled edge case, a
  boundary/semver hazard, an ownership/reuse miss) and returns ACCEPTABLE / RESHAPE NEEDED /
  BLOCKED. A `RESHAPE NEEDED` loops back to Phase 2 and rewrites the plan before approval, so the
  user only ever approves a design that already survived review. The phase before this was a
  *self*-check by the same lead that wrote the plan; this adds an outside set of eyes so agents
  can't run off and build a flawed plan. Depth scales with the review mode (from `gate_intensity`):
  solo → only on boundary-moving plans; lean → one `harsh-critic` pass; full → `harsh-critic`
  plus the relevant domain reviewer (`unsafe-auditor` / `security-auditor` / `api-design-lead` /
  `systems-perf-lead`) as a concurrent second lens. Trivial fast-path changes (Phase 0) skip it,
  as they skip Phases 1–3. Flow is now scout → plan → **plan-review** → approve → build → review.

## [0.22.0] - 2026-06-30

### Changed

- **Deduplicated orchestration boilerplate across the team skills.** `team-api`, `team-async`,
  `team-perf`, `team-release`, `dev-task`, and `spec-tasks` each restated the agent-team
  execution protocol (~25 drifted lines) that already lives canonically in
  `docs/coordination-protocol.md` §8. They now carry a tight reference + the one-line fallback
  guard §8 prescribes, keeping their skill-specific team composition and phases. Net −69 lines,
  zero drift.
- **`adopt` no longer re-derives the stack-signal table.** It invoked "`/detect-stack` logic"
  then inlined the dependency signals; it now calls `/detect-stack` (the canonical owner).
- **Sharper routing descriptions.** `model-domain` now states it encodes ONE concept (narrower
  than `/design-api`, no error type / full surface); `review` leads with "Rust maintainer-grade"
  to win routing over the generic built-in `/code-review`.

## [0.21.0] - 2026-06-30

### Changed

- **Tightened tool grants: every agent now blocks `NotebookEdit`.** The 5 read-only
  auditors already disallowed it; the other 28 agents inherited the full tool set and so
  carried `NotebookEdit` as dead weight (a Rust studio never edits Jupyter notebooks).
  Adding `disallowedTools: NotebookEdit` shrinks each agent's blast radius to match its
  role — the tool grant enforces the leash instead of relying on the prompt. The auditors
  keep their stricter `Write, Edit, NotebookEdit` disallow.

## [0.20.0] - 2026-06-30

### Fixed

- **Skills no longer write outputs into the plugin's own template files.** `add-dep`,
  `audit-unsafe`, `perf`, `architecture`, and `team-perf` populated reports at
  `${CLAUDE_PLUGIN_ROOT}/docs/templates/*` — the read-only install dir — instead of the
  user's project. They now write to `docs/*` in the project *from* the template (matching
  the `spec` pattern). Fixed dead skill refs (`/release` → `/team-release`, `/tooling` →
  `/ci-gate`) and a `session-wrap` specs path that pointed into the plugin dir.
- **`ffi.md` missing edition-2024 syntax.** Added `unsafe extern "C"` blocks and
  `#[unsafe(no_mangle)]` / `#[unsafe(export_name)]` — code written from the old guidance
  fails to compile on edition 2024. Corrected `unsafe.md`: `unsafe_op_in_unsafe_fn` is
  default-*warn* (not deny), matching `cargo-manifest.md`.
- **`auto-capture` re-nudged every dirty turn.** The `stop_hook_active` loop-breaker only
  suppressed a re-block within one continuation; across turns it reset. Added a
  per-session nudge cap (`MAX_NUDGES = 2`).
- **`stop-guard` false positives.** Demoted `incomplete-work` / `scope-escape` to soft
  (block only without evidence, so an honest evidence-backed "NEEDS WORK" passes); dropped
  `best-effort` and `edge case` phrases that the studio's own rules use approvingly.

### Added

- **`rust-reviewer` promoted to `opus`.** The final merge gate ran on `sonnet` while
  `harsh-critic` and the read-only auditors ran on `opus`; model capability now tracks
  decision stakes.
- **New path-scoped rules: `database.md`, `wasm.md`, `embedded.md`.** The DB, wasm, and
  embedded specialists existed with no standards to inject. `database-specialist` gains
  parameterized-query / injection discipline, cites `security.md` + `database.md`, and
  routes async-correctness to `async-runtime-specialist` and untrusted-input paths to
  `security-auditor`.
- **Domain owners cite their canonical rule.** `security-auditor` → `security.md`,
  `error-architect` → `error-model.md`, `observability-engineer` → `observability.md`.

## [0.19.0] - 2026-06-23

### Fixed

- **`stop_guard` no longer false-positives on meta-discussion.** The opt-in Stop guard scanned the
  raw final message, so a flagged phrase merely *discussed* in `inline code`, a fenced block, a
  "quote", or a `>` blockquote — including the guard's own category names like `incomplete-work` —
  tripped a hard block. It now strips code, inline code, blockquotes, and quoted spans before phrase
  matching (mirroring the always-on session-level guard), while still detecting completion evidence
  on the full text. Surfaced live the moment `stop_guard` was enabled as the primary guard;
  regression tests added (23/23 pass).

### Added

- **`stop_guard` loop cap.** The guard now gives up after 4 consecutive blocks in a session (a
  per-session counter, reset on a clean stop) so it can never trap a turn — matching the safety the
  session-level guard already had. Previously it relied only on the hang-watchdog, which guards
  against stalls but not a re-block loop.

## [0.18.0] - 2026-06-23

### Added

- **Given/When/Then scenario discipline** in `docs/testing-model.md` — a worked `RateLimiter`
  example (Given/When/Then → Rust `#[test]`) plus a case-enumeration rule that drives agents to
  **derive** realistic, diverse scenarios — the happy path **plus** error paths, boundaries
  (empty/zero/max/overflow/unicode), sequence/state (rollover, idempotence), and concurrency /
  cancellation for async — instead of writing a single happy-path example. This is the *generative*
  half of the existing `rules/testing.md` rule "happy-path-only is not done": the standard already
  requires the coverage; Given/When/Then is how the case set is produced. Also distinguishes
  example-based scenarios (Given/When/Then) from universal laws (`proptest`/`quickcheck`
  properties). `/dev-task` Phase 1, `/spec` Phase 4, and the `test-engineer` agent now derive
  acceptance criteria and tests this way.

## [0.17.0] - 2026-06-23

A studio-wide audit pass: propagate the new behavioral norms, make the methodology coherent across
the spec chain, and clear stale tool references.

### Added

- **`docs/testing-model.md`** — single source of truth for the double-loop (outer ATDD + inner
  TDD), observable-form acceptance criteria, the **one-outer-test-per-spec** propagation through
  `/spec → /spec-tasks → /dev-task → /spec-verify`, and the fast-path abort protocol. The six
  methodology skills now reference it instead of each redefining the concepts (the concepts were
  previously defined only inside `/dev-task`).
- **Behavioral norms now actually reach dispatched agents.** `coordination-protocol.md` §1 (read by
  26/33 agents) embeds a pointer to the three operating-mode norms from 0.16.0 —
  assessment-vs-action, finish-the-turn, communicate-the-result — which previously lived only in
  `working-preferences.md` (referenced by just 2/33 agents), so they barely propagated.

### Changed

- **Spec chain aligned to the double-loop** — resolves the cross-skill inconsistency the 0.16.0
  `/dev-task` rework introduced: `/spec` writes acceptance criteria in observable form (given/when/
  then) as the basis for one spec-level outer acceptance test; `/spec-tasks` passes that outer test
  to each `/dev-task` (tasks drive toward it; only an externally-observable task writes its own);
  `/spec-verify` runs the green outer test as the primary executable oracle; `/review` gains a
  spec-compliance anchor; `/tdd` is documented as the inner loop.

### Fixed

- **Removed stale `MultiEdit` references** (the tool was merged into `Edit` in current Claude Code)
  from the `PreToolUse` hook matcher and the `disallowedTools` of five read-only agents
  (`harsh-critic`, `rust-reviewer`, `security-auditor`, `unsafe-auditor`, `rust-scout`). Cosmetic —
  a matcher term that never fired — but removed for accuracy.

## [0.16.0] - 2026-06-23

### Added

- **Three cross-cutting behavioral norms in `working-preferences.md`** (the operating-mode canon
  every agent and skill honors), so agents communicate and self-manage better:
  - **Assessment vs. action** — when the owner is describing a problem, asking a question, or
    thinking out loud, the deliverable is the assessment: report and stop, don't apply a fix until
    a change is actually requested. Confirm evidence supports a state-changing command before
    running it; unrequested adjacent actions are scope creep. Sharpens the autonomy section
    (autonomy = executing a *requested* change, not inventing one).
  - **Finish the turn — don't end on intent** — before ending, if the last paragraph is a plan,
    a self-answerable question, a promise ("I'll…"), or next steps about undone work, do that work
    now. End only when complete or blocked on owner-only input.
  - **Communicate the result, not your working thread** — lead with the outcome; readability beats
    brevity; drop working shorthand (arrow chains, packed identifiers, coined labels) in the final
    summary; report outcomes faithfully and audit progress claims against tool results.
  - `agent-template.md` gains a one-line Output pointer so every new agent inherits the readability norm.

### Changed

- **`/dev-task` is now a right-sized double-loop**, informed by 2025–2026 spec-driven-development
  practice (GitHub Spec Kit / Kiro / BMAD) and Böckeler's SDD critique:
  - **Phase 0 — right-size the ceremony.** A **fast path** for genuinely trivial changes (single
    obvious edit site, no design fork, no public-API/`unsafe`/cross-crate/new-dep) skips Phases 1–3
    planning *overhead* — never the quality bar (red→green for behavior, clippy/fmt, a 5b review,
    a verdict all remain). Directly targets the documented SDD failure of turning a one-line fix
    into a multi-phase spec. Includes an anti-laundering guard: if triage proves wrong, stop and
    enter the full loop; "when in doubt, take the full loop."
  - **Double loop (ATDD outer + TDD inner).** Phase 1 writes a failing **outer acceptance test**
    for externally observable behavior (criteria in given/when/then form); Phase 4's unit-level
    red→green drives inward to make it pass; Phase 5a checks that **green acceptance test** as the
    executable spec-compliance anchor instead of re-reading prose. Fills the TDD-integration gap
    that mainstream SDD tools leave open. Phase 6's verdict is reconciled with the fast-path gate.

## [0.15.2] - 2026-06-21

### Fixed

- **Multi-agent skills no longer call the removed `TeamCreate`/`TeamDelete` tools.** Claude Code
  v2.1.178 removed those tools: every session now has **one implicit team** and shared task list,
  and teammates are spawned directly via the `Agent` tool with `name` (the `team_name` parameter
  is accepted but ignored). The orchestration prose in `coordination-protocol.md` §8 and the nine
  team-capable skills (`team-api`, `team-async`, `team-perf`, `team-release`, `dev-task`,
  `doc-review`, `eval-agents`, `review`, `spec-tasks`) still instructed the lead to call
  `TeamCreate` up front and `TeamDelete` at teardown — dead tool calls under the new runtime.
  - Teams are still gated by `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; the dual-path (team vs.
    single-orchestrator fallback) is unchanged. Only the lifecycle changed: spawn into the
    implicit team, and shut teammates down at the end with `SendMessage {type:"shutdown_request"}`
    (no `TeamDelete`; idle teammates auto-hide).
  - Removed the now-ignored `team_name` argument from the `Agent` spawn instructions in `team-api`.

### Changed

- **`auto-capture` Stop hook comment corrected for Claude Code v2.1.163.** Stop/`SubagentStop`
  hooks can now return `hookSpecificOutput.additionalContext`; the stale "a Stop hook cannot inject
  additionalContext" note is fixed. The hook deliberately keeps `exit 2 + stderr` — it must *block*
  the stop once to force the nudge, not merely append ignorable context. No behavior change.

## [0.15.1] - 2026-06-17

### Fixed

- **Sub-agents no longer return a verdict-only summary instead of their content.** The
  `SubagentStop` hook nagged **every** sub-agent — including built-ins like `Explore`,
  `general-purpose`, and `claude-code-guide` — when its final message lacked a studio verdict
  token. The nag landed in the sub-agent, which then appended a fresh verdict-only closing
  message; *that* became the message returned to the caller, while the actual deliverable (a
  research digest, a code map, an answer) survived only in the output file. The caller got
  "VERDICT: COMPLETE" and had to dig the content out of disk.
  - **Gating:** the hook now nags **only studio agents that owe a verdict** — classified by the
    agent's frontmatter `name` (the value `SubagentStop` actually passes as `agent_type`) against
    the `agents/*.md` roster (auto-maintained), plus a built-in denylist (`Explore`, `Plan`,
    `general-purpose`, `claude-code-guide`, …). Non-studio/data-returning agents are left alone.
  - **Non-displacing wording:** when it does nag, the reminder says to **append** the verdict as a
    trailing line to the existing deliverable — never to write a new verdict-only message or move
    the content elsewhere.
  - Documented the rule in `coordination-protocol.md` §5 and `agent-template.md`: the verdict
    supplements the deliverable, never replaces it; for data-return agents the data IS the
    deliverable. New tests for the gating (`owesStudioVerdict`, `normalizeAgentType`); 75/75 hook
    tests pass.

## [0.15.0] - 2026-06-16

### Changed

- **`/dev-task` approval gate now uses native plan mode** (pilot). Its plan/approve phases run
  through `EnterPlanMode` → write the plan file → `ExitPlanMode` instead of an `AskUserQuestion`
  "approve the plan?" card. The consolidated plan (lead's plan + maintainer pre-code verdict) is
  written to the plan file, so it renders live in the **Claude Code Desktop Plan pane** ("Claude
  writes the plan here as it explores") and is approved natively; on the CLI it is the standard
  plan-mode approval, so there is no regression. The orchestration model (delegate writes to
  `rust-builder`) and progress-visibility task list are unchanged. Verified by writing this
  release's own pilot plan to the plan file and approving it through the native flow.
- **Coordination Protocol §1** documents the pattern: implementation-planning skills MAY surface
  the Draft→Approval step through native plan mode; research/elicitation skills (`/brainstorm`,
  `/grill-me`) keep their own gate (`ExitPlanMode` is for code-bound plans). Rolls out to `/spec`,
  `/architecture`, `/refactor` after the `/dev-task` pilot validates in real Desktop use.

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
