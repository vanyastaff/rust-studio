# Rust Code Studio

<p>
  <img src="https://img.shields.io/badge/skills-11-111111?style=flat-square" alt="11 skills">
  <img src="https://img.shields.io/badge/agents-5-111111?style=flat-square" alt="5 roles">
  <img src="https://img.shields.io/badge/works%20with-70%2B%20hosts-111111?style=flat-square" alt="Works with 70+ hosts">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

A Rust engineering studio for coding agents: 11 skills that carry the standards a strict crate
maintainer would apply, five execution roles with reusable domain profiles, path-scoped rules,
and quality gates for libraries, async services, CLIs, and systems/embedded code.

**0.62.0 consolidates the catalog:** 59 former skill capabilities now have named modes under
11 public skills, and 33 former agent definitions map to five roles plus applicable profiles.
These mappings preserve legacy task/history interpretation. The old names are not exposed
as installed wrappers. Ten skills are portable. Maintain-studio requires the full plugin.

`/implement-change --mode implement` connects project context, design, fresh review, a new
implementation worker and destination acceptance. `/design-change --mode explore` and `/implement-change --mode plan`
provide exploration and planning without extra entry points. New designs live in `docs/designs`.
legacy designs remain readable in place. See the [workflow](plugins/rust-studio/docs/elephant-workflow.md),
[catalog](plugins/rust-studio/catalog.json) and
[changelog](plugins/rust-studio/CHANGELOG.md).

`/review-work --mode design --fresh` retains the fresh reviewer's understanding of the proposal.
`/review-work --mode design --drift` compares documentation with current code. Explicit byte snapshots
detect changed inputs without claiming semantic correctness or worker isolation. The
[EGM study](plugins/rust-studio/docs/upstream-elephant-goldfish-2026-11.md) records the upstream
evidence and adaptation boundaries.

**What changes when you install it.** Your agent stops writing plausible Rust and starts writing
Rust that a maintainer would merge: it locates before it edits, plans before it builds, follows
the authorized scope, runs `clippy` and the tests as evidence instead of asserting success (plus
`miri` where unsafe or concurrency is involved), and reviews its own diff against the standard
for the files it touched. The applicable standards include `unsafe.md` when a block appears,
`api.md` on `lib.rs`, and `ffi.md` at a C boundary.

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
| **Claude Code** | `/plugin marketplace add <owner>/rust-studio` then `/plugin install rust-studio@rust-studio` | Everything: skills, 5 roles, hooks, LSP, status line |
| **Codex** | `codex plugin marketplace add <owner>/rust-studio` then `codex plugin add rust-studio@rust-studio` | Skills, host-neutral hooks, 5 roles after one generator step (below) |
| **Cursor · Zed · Copilot · OpenCode · ~70 more** | `npx skills add .` | The skills, each self-contained |

Safe to re-run. No npm publish is needed: the [skills CLI](https://github.com/vercel-labs/skills)
reads a local clone or Git repo directly. For a remote install use `npx skills add <owner>/rust-studio`.

Prerequisites (Bun, rust-analyzer), local-clone installs and the `settings.json` route live in
**[INSTALL.md](INSTALL.md)**.

<details>
<summary><strong>Codex sub-agents, single skills, and the Agent Plugins door</strong></summary>

<br>

**Codex sub-agents take one extra command.** The plugin ships agent briefs as Markdown but Codex
wants TOML, so generate the five roles into `~/.codex/agents/` (pass a path for a
project-local `.codex/agents/`). Re-run after upgrading.

```bash
node plugins/rust-studio/scripts/generate-codex-agents.mjs
```

Upgrades retire only unchanged files recorded as generated. Unknown/customized old definitions
are preserved and reported. Without managed agents, inline work remains useful but cannot
claim required fresh review, handoff or independent acceptance.

**One skill, one agent, no prompts:**

```bash
npx skills add . --skill implement-change --agent codex -y
npx skills add . --skill '*' --agent '*' -y
```

**Agent Plugins 1.0 is withdrawn, on purpose.** The plugin used to ship a root `plugin.json`
in the [Agent Plugins 1.0](https://agent-plugins.org) format as one more door for Cursor,
Copilot CLI and Kiro. It also closed a bigger one: on Codex CLI 0.153 that manifest's `$schema`
switches loading to a path that reads skills, MCP servers and apps but **not hooks**
([openai/codex#16430](https://github.com/openai/codex/issues/16430)), so every studio hook went
silent (no briefing, no path-scoped standards) while Codex's own panel just said "No plugin
hooks". The standard requires `$schema` and forbids declaring `hooks`, so there is no compliant
way to keep both. This was measured, not assumed. The manifest comes back when Codex runs
plugin hooks alongside it. Those clients still install the skills through `npx skills add`.

**Claude desktop app** has no `/plugin` command. Add the marketplace from Customize → personal
plugins → Add from repository.

</details>

---

## Using it

### Your first session

```text
/inspect-project --mode orient                        # detects your stack, briefs the team, tells you what to run next
/implement-change --mode implement add a retry policy to the http client
```

`/inspect-project --mode orient` is the orientation command. Run it once in a new repo. After that, `/implement-change --mode implement` is the
one you'll use most.

### Three ways in

1. **Run a skill**: `/implement-change --mode implement <what you want>`. The skill drives the whole flow. This is the
   usual entry point. Type `/rust-studio:<name>` if a bare `/<name>` is ambiguous on your host.
2. **Name an agent**: "use `reviewer` with the `systems` profile on this module" delegates one focused job. Your
   agent also picks the right specialist on its own from their descriptions.
3. **Just describe the task**: no slash command is needed, and the routing picks a skill for you.

### What actually happens when you run `/implement-change --mode implement`

Substantive work follows the Elephant lifecycle. Existing authorization continues. Questions
are reserved for unresolved user decisions or missing authorization:

```
0  triage       small obvious tasks keep the fast path
1  context      original request, project constraints and current source evidence
2  design       behavior, ownership, failures, migration and acceptance in one spec
3  Goldfish     fresh review reconstructs and challenges that design
4  handoff      fresh implementer reconstructs artifacts before its first write
5  deliver      test-first implementation, review and destination integration
6  acceptance   independent original-request check plus current project gates
7  verdict      COMPLETE / NEEDS WORK / BLOCKED with evidence
```

Freshness checks bind the handoff to inventoried bytes. They do not certify semantics or
permission. Explicit design-only requests stop at the design. Missing required isolation is
reported as unverified. See the [workflow contract](plugins/rust-studio/docs/elephant-workflow.md).

### A whole feature, end to end

```text
/inspect-project --mode recall <area>          # what was learned about this area last time
/design-change --mode explore <idea>  # compare approaches when the direction is still open
/design-change --mode specification <feature>         # self-contained design and fresh review
/implement-change --mode plan <slug> # write/reconcile tasks, then stop before implementation
/implement-change --mode implement <task>        # one unit of work
/implement-change --mode test-first <behavior>         # or build it test-first: RED → GREEN → REFACTOR
/implement-change --mode repair-gate            # drive checks to green with bounded auto-fix
/review-work --mode diff --full          # parallel multi-lens audit before merge
/publish-change --mode commit → /publish-change --mode pull-request           # Conventional Commit, then open the PR
/write-docs --mode handoff           # preserve execution evidence; memory follows authorization
```

**Small change?** Skip the spec. `/implement-change --mode implement`, or even just `/verify-work --mode lint` + `/review-work --mode diff`, is enough. Plan
only when the approach is uncertain or the change spans files.

New artifacts live in `docs/designs/<slug>/`: spec, tasks, optional acceptance ledger and
verification report. Existing `.rust-studio/specs/<slug>/` designs remain readable in place.
An ambiguous slug requires an explicit path. Custom locations use direct acceptance checks
with `--cwd <root>`. Automatic Stop-guard discovery covers only the two default roots.

### The five you'll actually reach for

| Command | When |
|---|---|
| `/implement-change --mode implement <task>` | Implement one unit of work, properly |
| `/review-work --mode diff` | Audit your current diff before you push |
| `/implement-change --mode compiler` | The build or type-check is broken |
| `/maintain-project --mode dependency <crate>` | Vet a crate: RUSTSEC, license, MSRV, features, redundancy |
| `/inspect-project --mode catalog` | The live list, on the host you're on |

### If your project is a workspace

Most Rust projects become one, and the defaults stop fitting: a single root context file either
bloats with every crate's conventions or says nothing useful, and a scoped test command can lie
to you.

`/inspect-project --mode onboard` proposes **per-crate context files**. It shows you which crates earned one, which it
dropped and why, so you can strike individual crates instead of accepting a block of thirty, and
it writes within the authorized adoption scope. The content goes in `AGENTS.md`, plus a two-line `CLAUDE.md`
beside it holding only `@AGENTS.md`. That split is not a preference: Claude Code reads
`CLAUDE.md` and not `AGENTS.md`, and only `CLAUDE.md` loads on demand as it moves through
subdirectories, while Codex, Cursor and Copilot read `AGENTS.md`. A pointer file holds no facts,
so the two cannot drift. Each file is capped and pruned by one rule: **a line true of two
crates belongs in the root context**. Promote it there and remove both copies.

The other half is knowing which commands survive being scoped to one crate:

```bash
cargo test -p my-crate                               # can be a FALSE GREEN
cargo nextest run --workspace -E 'package(my-crate)'  # what to trust
```

Features unify across the graph cargo actually builds, so a crate whose sibling enables a
feature on a shared dependency passes on its own and fails under `--workspace`. `--all-features`
does not save you because it applies only to the selected package. The full set of what scopes safely
and what lies, with reproductions, is in
[`docs/large-workspace.md`](plugins/rust-studio/docs/large-workspace.md).

---

## What's under the hood

- **Five roles** separate research, design, implementation, review and verification. All except
  implementer are read-only. Load every applicable domain profile. Independence comes from
  separate fresh instances and controlled inputs, not role names.
- **Skills (11)** are focused workflows. They add process only when the task needs it.
- **Rules (22)** are path-scoped standards. Edit a matching file and a *pointer* to the relevant
  rule is injected automatically. The agent pulls the full text on demand. `core.md` on every
  `.rs`, `api.md` on `lib.rs`, `unsafe.md` when `unsafe` appears, `macros.md` inside macros.
- **Hooks (10 events)** cover stack briefing and memory recall at session start, rule pointers after
  edits (per window, so a sub-agent gets them too), a fact brief for every studio sub-agent it
  spawns, a lint nudge when you stop, a check that blocks a verdict-less finish, a note when
  the model switches so you know who is judging now, and a usage log of which skills and agents
  a week actually reached for.
- **Gates** are named checkpoints: `ARCH / API / ASYNC / CLI / PERF / SAFETY / QA / RELEASE /
  BUILD`, run at **lean** (one crate), **full** (public API, unsafe, releases), or **solo**
  (prototype) intensity.

Full detail: **[usage guide](plugins/rust-studio/docs/usage-guide.md)**.

---

## The skills

`/inspect-project --mode orient` for a tour, `/inspect-project --mode catalog` for the live list under the plugin.

| Skill | Operations | Invocation and packaging |
|---|---|---|
| `inspect-project` | onboard, classify, catalog, recall, orient, diagnose-host | Discoverable; Portable |
| `research-topic` | investigate | Discoverable; Portable |
| `design-change` | architecture, api, clarify, domain, prototype, specification, tests, explore | Discoverable; Portable |
| `implement-change` | size, diagnose, implement, compiler, intermittent, conflicts, performance, refactor, pr-feedback, test-first, repair-gate, plan | Discoverable; Portable |
| `review-work` | api, soundness, dependencies, design, memory, prose, diff, scope, security, structure | Discoverable; Portable |
| `verify-work` | ledger, coverage, fuzz, lint, minimum-rust, mutation, acceptance | Discoverable; Portable |
| `write-docs` | decision, changelog, memory, handoff | Discoverable; Portable |
| `configure-tooling` | ci, environment, tests | Discoverable; Portable |
| `maintain-project` | dependency, improve, migrate, scaffold, worktrees | Explicit invocation; Portable |
| `maintain-studio` | evaluate, status-line | Explicit invocation; Full plugin only |
| `publish-change` | commit, pull-request, release | Explicit invocation; Portable |

## What you get, where

| | skills via `npx` | Codex plugin | Claude Code plugin |
|---|---|---|---|
| 10 portable skills + 1 plugin-only maintenance entry | portable procedures; maintenance requires full plugin | yes, with maintenance host limits | yes |
| Standards the skills cite | bundled per skill | bundled per skill | shared + hook injection |
| 5 managed roles | no; required isolation still needs host workers | yes, after one generator step | yes |
| Session briefing + path-scoped rule injection | no | yes | yes |
| Irreversible-action guard | no | yes | yes |
| Acceptance ledger (`/verify-work --mode ledger` checker) + Stop guard | checker only (the skill bundles it) | yes (the guard binds through the transcript path Codex hands its hooks) | yes |
| Stop-guard, auto-capture, sub-agent verdict check | no | no (these read the Claude transcript) | yes |
| LSP, status line, background monitors | no | no | yes |
| Evaluation tooling (`tools/eval-runner.ts`) | no | supported source/runtime modes only | supported source/runtime modes |

> [!NOTE]
> `/maintain-studio --mode status-line` and `/maintain-studio --mode evaluate` are Claude Code-only utilities, and explicit-invocation-only
> in Codex. The other ten skills, including configure-tooling and inspect-project, are portable.

> [!TIP]
> A skill that says "delegate the build to `implementer` with the `implementation` profile" runs that phase itself on a host with
> no sub-agents, rather than stalling. The rule is
> [`docs/sub-agents.md`](plugins/rust-studio/docs/sub-agents.md); every skill that names an agent
> ships a copy, and CI enforces it.

Ten portable workflows bundle procedures, profiles, standards and deterministic helpers.
The maintain-studio entry requires the full plugin and its supported host/source environment.

The skills are [Agent Skills](https://agentskills.io) and run on any skill-capable host. Claude
Code gets the full ambient studio. Codex gets the portable skills, host-neutral hooks (session
briefing, routing and rustfmt nudges) and the 5 roles as generated Codex custom agents — never
Claude-specific lifecycle code.

---

## Contributing

`docs/` and `rules/` are the single source of truth. Each skill carries a copy of what it cites
under `skills/<name>/references/`, so it stays self-contained when installed standalone.
Regenerate after editing either source. Changes made directly under `references/` are discarded
by the next regeneration:

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
that resolve to nothing, missing inline fallbacks, vendor-only APIs leaking into the 10 portable
skills, catalog drift, and malformed eval cases. CI also runs `claude plugin validate --strict`
and the [agnix](https://github.com/agent-sh/agnix) agent-config linter. The prompts themselves
are measured, not just parsed: `plugins/rust-studio/tools/eval-runner.ts` runs every eval case and
every agent fixture over the headless CLI and scores them against their rubrics and ground truth
(`bun tools/eval-runner.ts --fixtures`). CI uses it as the gate wherever `claude plugin eval` is
not enabled.

### Releasing

Keep the version in both plugin manifests identical, update the changelog, validate and commit
the release. Push `main` and check its CI before publishing the version tag:

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
│       ├── agents/                  # 5 roles + OpenAI UI metadata
│       ├── assets/                  # Codex install-surface artwork
│       ├── skills/                  # 11 skills + references + OpenAI metadata
│       ├── evals/                   # claude plugin eval suite (plugin only)
│       ├── hooks/                   # Claude hook config + Bun/TypeScript
│       ├── rules/                   # 21 path-scoped Rust standards
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
