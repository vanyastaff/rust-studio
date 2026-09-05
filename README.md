# Rust Code Studio

<p>
  <img src="https://img.shields.io/badge/skills-62-111111?style=flat-square" alt="62 skills">
  <img src="https://img.shields.io/badge/agents-33-111111?style=flat-square" alt="33 agents">
  <img src="https://img.shields.io/badge/works%20with-70%2B%20hosts-111111?style=flat-square" alt="Works with 70+ hosts">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

A Rust engineering studio for coding agents: 62 skills that carry the standards a strict crate
maintainer would apply, 33 agents arranged architect → leads → specialists, path-scoped rules,
and quality gates for libraries, async services, CLIs, and systems/embedded code.

**What changes when you install it.** Your agent stops writing plausible Rust and starts writing
Rust that a maintainer would merge: it locates before it edits, plans before it builds, asks you
to approve the plan, runs `clippy` and the tests as evidence instead of asserting success (plus
`miri` where unsafe or concurrency is involved), and reviews its own diff against the standard
for the files it touched — `unsafe.md` when a block appears, `api.md` on `lib.rs`, `ffi.md` at a
C boundary.

---

## Install

```bash
git clone <owner>/rust-studio && cd rust-studio
./install.sh            # --dry-run to preview
```

That one command detects the agents on your machine and installs the right shape for each. Pick
your row if you'd rather do it by hand:

| You use | Run this | You get |
|---|---|---|
| **Claude Code** | `/plugin marketplace add <owner>/rust-studio` then `/plugin install rust-studio@rust-studio` | Everything: skills, 33 agents, hooks, LSP, status line |
| **Codex** | `codex plugin marketplace add <owner>/rust-studio` then `codex plugin add rust-studio@rust-studio` | Skills, host-neutral hooks, 33 agents after one generator step (below) |
| **Cursor · Zed · Copilot · OpenCode · ~70 more** | `npx skills add .` | The skills, each self-contained |

Safe to re-run. No npm publish needed — the [skills CLI](https://github.com/vercel-labs/skills)
reads a local clone or Git repo directly; for a remote install use `npx skills add <owner>/rust-studio`.

Prerequisites (Bun, rust-analyzer), local-clone installs and the `settings.json` route live in
**[INSTALL.md](INSTALL.md)**.

<details>
<summary><strong>Codex sub-agents, single skills, and the Agent Plugins door</strong></summary>

<br>

**Codex sub-agents take one extra command.** The plugin ships agent briefs as Markdown; Codex
wants TOML, so generate them once — this writes all 33 into `~/.codex/agents/` (pass a path for a
project-local `.codex/agents/`). Re-run after upgrading.

```bash
node plugins/rust-studio/scripts/generate-codex-agents.mjs
```

Without it the skills still work; they just run each phase inline instead of delegating.

**One skill, one agent, no prompts:**

```bash
npx skills add . --skill dev-task --agent codex -y
npx skills add . --skill '*' --agent '*' -y
```

**Agent Plugins 1.0.** The plugin directory is also an [Agent Plugins 1.0](https://agent-plugins.org)
package (root `plugin.json` + flat `skills/`), which Codex ≥ 0.147, Cursor, GitHub Copilot CLI
≥ 1.0.74 and Kiro load directly — the same skills, one more door.

**Claude desktop app** has no `/plugin` command — add the marketplace from Customize → personal
plugins → Add from repository.

</details>

---

## Using it

### Your first session

```text
/start                        # detects your stack, briefs the team, tells you what to run next
/dev-task add a retry policy to the http client
```

`/start` is the orientation command — run it once in a new repo. After that, `/dev-task` is the
one you'll use most.

### Three ways in

1. **Run a skill** — `/dev-task <what you want>`. The skill drives the whole flow. This is the
   usual entry point. Type `/rust-studio:<name>` if a bare `/<name>` is ambiguous on your host.
2. **Name an agent** — "use `unsafe-auditor` on this module" delegates one focused job. Your
   agent also picks the right specialist on its own from their descriptions.
3. **Just describe the task** — no slash command needed; the routing picks a skill for you.

### What actually happens when you run `/dev-task`

It is a quality loop, not a permission loop. You get asked once, at the point where your answer
changes the work:

```
0  triage      right-size the ceremony — a typo fix does not get the full pipeline
1  locate      rust-scout maps the types, impls and call sites involved (read-only)
2  plan        the smallest correct change that fits the existing architecture
2.5 critique   an adversarial pass attacks the plan before you ever see it
3  APPROVE     ← you decide here
4  build       rust-builder writes code and tests, runs check/clippy/test/fmt
5  review      rust-reviewer audits the diff — severity-tagged findings, no praise
6  verdict     COMPLETE / NEEDS WORK / BLOCKED, with the command output as evidence
```

Between those gates, agents decide tactical calls and proceed. They come back to you for a
strategic fork, an irreversible action, or an outward one — push, PR, `cargo publish`.

### A whole feature, end to end

```text
/recall <area>          # what was learned about this area last time
/spec <feature>         # big or cross-crate: intent → explore → approaches → approved spec
  /spec-tasks <slug>    #   split into ordered tasks, each run through /dev-task
/dev-task <task>        # one unit of work
/tdd <behavior>         # or build it test-first: RED → GREEN → REFACTOR
/verify-loop            # drive checks to green with bounded auto-fix
/review --full          # parallel multi-lens audit before merge
/commit → /pr           # Conventional Commit, then open the PR
/session-wrap           # capture what was learned for next session
```

**Small change?** Skip the spec. `/dev-task`, or even just `/lint` + `/review`, is enough. Plan
only when the approach is uncertain or the change spans files.

### The five you'll actually reach for

| Command | When |
|---|---|
| `/dev-task <task>` | Implement one unit of work, properly |
| `/review` | Audit your current diff before you push |
| `/fix-build` | The build or type-check is broken |
| `/add-dep <crate>` | Vet a crate: RUSTSEC, license, MSRV, features, redundancy |
| `/help` | The live list, on the host you're on |

### If your project is a workspace

Most Rust projects become one, and the defaults stop fitting: a single root context file either
bloats with every crate's conventions or says nothing useful, and a scoped test command can lie
to you.

`/adopt` proposes **per-crate context files** — it shows you which crates earned one, which it
dropped and why, so you can strike individual crates instead of accepting a block of thirty, and
writes only what you approve. The content goes in `AGENTS.md`, plus a two-line `CLAUDE.md`
beside it holding only `@AGENTS.md`. That split is not a preference: Claude Code reads
`CLAUDE.md` and not `AGENTS.md`, and only `CLAUDE.md` loads on demand as it moves through
subdirectories, while Codex, Cursor and Copilot read `AGENTS.md`. A pointer file holds no facts,
so the two cannot drift. Each file is capped and pruned by one rule — **a line true of two
crates is not a crate line**, it gets promoted to the root and deleted from both.

The other half is knowing which commands survive being scoped to one crate:

```bash
cargo test -p my-crate                               # can be a FALSE GREEN
cargo nextest run --workspace -E 'package(my-crate)'  # what to trust
```

Features unify across the graph cargo actually builds, so a crate whose sibling enables a
feature on a shared dependency passes on its own and fails under `--workspace`. `--all-features`
does not save you — it applies only to the selected package. The full set of what scopes safely
and what lies, with reproductions, is in
[`docs/large-workspace.md`](plugins/rust-studio/docs/large-workspace.md).

---

## What's under the hood

- **Agents (33)** — the workforce, in three tiers: directors decide, leads own a domain and its
  quality gate, specialists do the work. Each runs in its own context, so their reading never
  crowds your conversation.
- **Skills (62)** — the workflows. A skill orchestrates the right agents through phases.
- **Rules (20)** — path-scoped standards. Edit a matching file and a *pointer* to the relevant
  rule is injected automatically; the agent pulls the full text on demand. `core.md` on every
  `.rs`, `api.md` on `lib.rs`, `unsafe.md` when `unsafe` appears, `macros.md` inside macros.
- **Hooks (9 events)** — stack briefing and memory recall at session start, rule pointers after
  edits (per window, so a sub-agent gets them too), a fact brief for every studio sub-agent it
  spawns, a lint nudge when you stop, a check that blocks a verdict-less finish, and a note when
  the model switches so you know who is judging now.
- **Gates** — named checkpoints: `ARCH / API / ASYNC / CLI / PERF / SAFETY / QA / RELEASE /
  BUILD`, run at **lean** (one crate), **full** (public API, unsafe, releases), or **solo**
  (prototype) intensity.

Full detail: **[usage guide](plugins/rust-studio/docs/usage-guide.md)**.

---

## The skills

`/start` for a tour, `/help` for the live list under the plugin.

| Group | Skills |
|---|---|
| Build one thing | `dev-task` `tdd` `fix-build` `verify-loop` `debug` `refactor` |
| Specify & design | `spec` `spec-tasks` `spec-verify` `architecture` `design-api` `model-domain` `adr` `brainstorm` `grill-me` |
| Review & audit | `review` `api-review` `doc-review` `security-audit` `audit-unsafe` `scope-check` `tech-debt` `bloat` |
| Test | `test-plan` `test-setup` `coverage` `mutants` `fuzz` `flaky-hunt` |
| Ship | `commit` `pr` `resolve-pr` `changelog` `publish` `msrv-check` `ci-gate` |
| Dependencies & perf | `add-dep` `deps-check` `perf` |
| Team pipelines | `team-api` `team-async` `team-perf` `team-release` |
| Memory | `recall` `remember` `memory-doctor` `session-wrap` |
| Setup | `start` `adopt` `new-crate` `detect-stack` `lint` `env-setup` `help` `progress-bar` `eval-agents` |

## What you get, where

| | skills via `npx` | Codex plugin | Claude Code plugin |
|---|---|---|---|
| 62 skills | yes | yes | yes |
| Standards the skills cite | bundled per skill | bundled per skill | shared + hook injection |
| 33 named studio agents | no — phases run inline | yes, after one generator step | yes, spawned per phase |
| Session briefing + path-scoped rule injection | no | yes | yes |
| Irreversible-action guard | no | yes | yes |
| Stop-guard, auto-capture, sub-agent verdict check | no | no — these read the Claude transcript | yes |
| LSP, status line, background monitors | no | no | yes |
| `claude plugin eval` suite (10 cases, no-plugin baseline arm) | no | no | yes |

> [!NOTE]
> `/progress-bar` and `/eval-agents` are Claude Code-only utilities, and explicit-invocation-only
> in Codex. The other 60 skills, including `/env-setup` and `/help`, are standalone.

> [!TIP]
> A skill that says "delegate the build to `rust-builder`" runs that phase itself on a host with
> no sub-agents, rather than stalling. The rule is
> [`docs/sub-agents.md`](plugins/rust-studio/docs/sub-agents.md); every skill that names an agent
> ships a copy, and CI enforces it.

The 60 host-neutral workflows bundle their standards and deterministic helpers, so they work
installed alone. Two clearly labeled Claude utilities remain in the catalog for full-plugin use.

The skills are [Agent Skills](https://agentskills.io) and run on any skill-capable host. Claude
Code gets the full ambient studio; Codex gets the portable skills, host-neutral hooks (session
briefing, routing and rustfmt nudges) and the 33 agents as generated Codex custom agents — never
Claude-specific lifecycle code.

---

## Contributing

`docs/` and `rules/` are the single source of truth. Each skill carries a copy of what it cites
under `skills/<name>/references/`, so it stays self-contained when installed standalone.
Regenerate after editing either — never hand-edit a file under `references/`, the next
regeneration discards it:

```bash
cd plugins/rust-studio
./scripts/sync-references.sh           # rebuild references + portable helpers
node scripts/generate-openai-metadata.mjs
./scripts/validate-distribution.sh     # what CI runs before Bun tests
bun test
```

Validation catches manifest/marketplace drift (all three manifests), non-standard skill or agent
frontmatter, description-budget regressions, skill descriptions that overlap without declaring a
boundary, unsafe patterns in shipped scripts, stale metadata or references, section citations
that resolve to nothing, missing inline fallbacks, vendor-only APIs leaking into the 60 portable
skills, catalog drift, and malformed eval cases. CI also runs `claude plugin validate --strict`
and the [agnix](https://github.com/agent-sh/agnix) agent-config linter.

### Releasing

Keep the version in both plugin manifests identical, then tag and push:

```bash
cd plugins/rust-studio
claude plugin tag --push      # creates rust-studio--v<version> from the manifest
```

Full checklist: [`plugins/rust-studio/docs/releasing.md`](plugins/rust-studio/docs/releasing.md).

<details>
<summary><strong>Repository layout</strong></summary>

<br>

```
rust-studio/                         (repo + neutral "rust-studio" marketplace)
├── .agents/plugins/
│   └── marketplace.json             # Codex marketplace
├── .claude-plugin/
│   └── marketplace.json             # Claude Code marketplace
├── plugins/
│   └── rust-studio/                 # the plugin
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── .lsp.json                # bundled rust-analyzer LSP
│       ├── agents/                  # 33 Claude agents + OpenAI UI metadata
│       ├── assets/                  # Codex install-surface artwork
│       ├── plugin.json              # Agent Plugins 1.0 manifest (Codex/Cursor/Copilot/Kiro)
│       ├── skills/                  # 62 skills + references + OpenAI metadata
│       ├── evals/                   # claude plugin eval suite (plugin only)
│       ├── hooks/                   # Claude hook config + Bun/TypeScript
│       ├── rules/                   # 20 path-scoped Rust standards
│       ├── output-styles/           # opt-in terse review style   (plugin only)
│       ├── monitors/                # background monitors         (plugin only)
│       ├── docs/                    # protocol, roster, releasing, templates/
│       ├── scripts/                 # sync-references.sh, env-setup.sh, statusline
│       └── README.md
├── INSTALL.md
└── LICENSE
```

</details>

## License

MIT — see [LICENSE](LICENSE).
