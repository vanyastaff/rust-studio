# Codex compatibility notes

How the studio runs on Codex, and the authoring rules that keep it working there. The Claude
analogue is `claude-5-compat.md`; this file covers only what differs. Grounded in OpenAI's
official guidance, re-checked 2026-09-07:

- [Prompting](https://learn.chatgpt.com/docs/prompting)
- [Best practices](https://learn.chatgpt.com/guides/best-practices)
- [Configuration reference](https://developers.openai.com/codex/config-reference)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

**Do not hardcode a Codex model name anywhere in this plugin.** The lineup and its naming have
changed repeatedly, and a drifted constant in a prompt is worse than no constant — it reads as
authoritative. Name the *layer* (session default, profile, per-agent override) and point at the
live docs.

## What reaches the model on Codex

| Studio asset | Codex path | Notes |
|---|---|---|
| 62 skills | native, via `.codex-plugin/plugin.json` → `skills/` | Also installable standalone with `npx skills add` |
| 8 hooks | `hooks/codex-hooks.json` | Working since v0.50.0 — see below |
| 33 agents | generated TOMLs in `~/.codex/agents/` | `scripts/generate-codex-agents.mjs`, run by `install.sh` |
| `rules/` standards | delivered by the `inject-rules` hook | Falls back to the `AGENTS.md` fragment when hooks are off |
| `LSP` tool | **absent** | serena MCP or `rg` — `tooling.md` |

**Hooks work.** They were dark for two releases, and the cause was ours: the root `plugin.json`
declaring the Agent Plugins 1.0 `$schema` silenced every plugin hook while Codex still reported
them completed. That manifest is withdrawn and the regression is guarded by `RS-MANIFEST-058`
(ADR 0002). Anything that still says "Codex does not run plugin hooks" is stale — check with
`/studio-doctor`, which probes rather than assumes.

**Agent briefs lose their model pin on purpose.** The generator drops `model:` and never emits
`model_reasoning_effort`, so every generated agent inherits the session's model and effort.
Codex custom-agent files *do* accept both fields, and pinning them is the same
model-agnosticism break the Claude side rejects: it would decide for the user which model
judges their code. Same decision, both hosts — effort is the user's dial.

## The prompt shape Codex documents, and what the studio already supplies

OpenAI's guidance asks a user prompt to carry four things: **goal, context, constraints, and
how to verify**. Three of the four are what this plugin *is* — the skills carry the method, the
`rules/` files carry the constraints, and the verdict vocabulary carries "done when". A user
invoking `/dev-task` or `/review` should only need to supply the goal and point at the code.

That is the test to hold a skill to: if a Codex user still has to hand-write constraints and a
definition of done to get a usable result, the skill is under-specified, not the prompt.

## Layered configuration, and where the studio's fragment goes

Codex walks up from the working directory to the project root, merging as it goes; **more
specific wins**.

- `AGENTS.md` — `~/.codex/AGENTS.md` (personal defaults), the repository's own `AGENTS.md`,
  `.codex/AGENTS.md`, and per-directory files deeper in the tree. The studio's fragment
  (`templates/agents-md.md`) belongs at the **repository** level. In a Cargo workspace with
  genuinely different rules per crate — a `no_std` firmware crate beside an async service —
  a directory-level `AGENTS.md` beside that crate is the right place for the difference, and
  it is the closest Codex equivalent to the path-scoped `rules/` the hooks inject on Claude.
- `config.toml` — `~/.codex/config.toml` and the repo's `.codex/config.toml` carry model
  choice, reasoning effort, sandbox mode, approval policy, profiles, and MCP servers. The
  studio ships none of these and should not: sandbox and approval policy are the user's
  security posture, not a plugin's to set.
- Skills — `$HOME/.agents/skills` for personal, `.agents/skills` in the repo for the team.

**Keep the fragment short.** OpenAI's own maintenance rule for `AGENTS.md` is to add a rule only
after observing a repeated mistake. The studio's fragment already sits at the edge of what a
file loaded into every session should cost; anything that can be a skill should be a skill.

## Command overlap — prefer the studio's, and say why

Codex ships `/plan` and `/review` of its own. They are good and they are generic; the studio's
are Rust-specific and end in a gate verdict with evidence attached. The overlap is worth naming
in the skill descriptions rather than pretending it isn't there:

- Codex `/plan` gathers context and asks clarifying questions → studio `/brainstorm` compares
  2–4 approaches with a `harsh-critic` pass, `/spec` writes the frozen contract, `/spec-tasks`
  orders the work.
- Codex `/review` diffs against a base branch → studio `/review` runs the maintainer-bar
  checklist, the oracle-weakening checks, and the gate lenses, and returns
  COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED.
- OpenAI suggests pointing `AGENTS.md` at a `code_review.md` so review behavior is consistent
  across repos. On this plugin that file is `/review` plus `verdicts.md`; a repo that wants
  Codex's built-in reviewer to match the studio's bar can point its `code_review.md` at them.

## Anti-patterns from the Codex guidance that bear on authoring

- **Durable rules do not belong in prompts.** They belong in `AGENTS.md` or a skill. This is
  the plugin's whole premise, and it is also the pruning rule in `writing-skills.md` §7: one
  meaning, one home.
- **Do not micromanage step-by-step.** Same finding as the Claude side, from the other vendor —
  keep "How you work" at intent level.
- **Do not hide build and test output from the agent.** A hook or wrapper that swallows a
  `cargo` failure and reports a summary breaks verification. The studio's rule is stronger:
  a claim carries the command that produced it (`integrity-and-evidence.md`).
- **Use worktrees for parallel work.** `/worktree-sweep` exists for this; running concurrent
  agents over one working tree is how two changes overwrite each other.
- **Prove a workflow by hand before scheduling it.** Applies to any of the studio's skills
  wired into a scheduled task.

## What deliberately did NOT change

- No Codex model name, reasoning-effort level, sandbox mode, or approval policy is set by this
  plugin. Those are session-level user choices.
- The tiered roster, the gates, and the verdict vocabulary are identical on both hosts. Only
  the delivery surface differs — `sub-agents.md` covers the inline fallback where a host has no
  sub-agents at all.
