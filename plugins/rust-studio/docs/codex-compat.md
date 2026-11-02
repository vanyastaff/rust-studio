# Codex compatibility notes

How the studio runs on Codex, and the authoring rules that keep it working there. The Claude
analogue is `claude-5-compat.md`; this file covers only what differs. Grounded in OpenAI's
official guidance, re-checked **2026-11-01**:

- [Prompting](https://learn.chatgpt.com/docs/prompting)
- [Best practices](https://learn.chatgpt.com/guides/best-practices)
- [Configuration reference](https://developers.openai.com/codex/config-reference)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Changelog](https://developers.openai.com/codex/changelog)
- [Hooks](https://learn.chatgpt.com/docs/hooks)
- [Plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Skill discovery](https://developers.openai.com/codex/build-skills)

**Do not hardcode a Codex model name anywhere in this plugin.** The lineup and its naming have
changed repeatedly, and a drifted constant in a prompt is worse than no constant — it reads as
authoritative. Name the *layer* (session default, profile, per-agent override) and point at the
live docs.

## What reaches the model on Codex

| Studio asset | Codex path | Notes |
|---|---|---|
| Skills | native, via `.codex-plugin/plugin.json` → `skills/` | Inventory comes from the manifest and distribution validator |
| Hooks | `hooks/codex-hooks.json` | Delivery requires host support, configuration and trust |
| 5 roles | generated TOMLs in `~/.codex/agents/` | `scripts/generate-codex-agents.mjs`, run by `install.sh` |
| `rules/` standards | delivered by the `inject-rules` hook | Falls back to the `AGENTS.md` fragment when hooks are off |
| `LSP` tool | **absent** | serena MCP or `rg` — `tooling.md` |

**Local plugin hooks are supported.** They were dark for two releases, and the cause was ours: the root `plugin.json`
declaring the Agent Plugins 1.0 `$schema` silenced every plugin hook while Codex still reported
them completed. That manifest is withdrawn and the regression is guarded by `RS-MANIFEST-058`
(ADR 0002). Anything that still says "Codex does not run plugin hooks" is stale — check with
`/inspect-project --mode diagnose-host`, which probes rather than assumes.

## November compatibility refresh

The fetched changelog's newest CLI release is **0.166.0, October 29, 2026**. It includes
resume/fork permission fixes and `codex doctor --network-only`. Check `--help` on the installed
binary before recommending that diagnostic; the desktop app and CLI may use different builds.
Model-catalog additions do not authorize changing the user's selected model.

The current hook contract uses `hookSpecificOutput` with `hookEventName` and `additionalContext`
for SessionStart, UserPromptSubmit, PreToolUse and SubagentStart. Codex sets `PLUGIN_ROOT` plus
the `CLAUDE_PLUGIN_ROOT` compatibility alias. Detect Codex first from its own variable; the
alias does not mean Claude auto-memory already loaded the index. Keep Stop blocking as a JSON
decision. The previous top-level context format recorded in release 0.59.1 describes an older
host; this adapter targets the current documented protocol.

SubagentStart now documents `agent_type`; shell hooks can use canonical `Bash` and
`tool_input.command`. Existing payload-based guards also accept older `exec_command`/`cmd`
input. Keep unmatched registrations unless coverage is verified for every intended tool.

Hooks require trust of the current definitions. A direct script probe proves script behavior;
only a host-delivered event proves loading and trust. Local hooks are not a guarantee for
cloud orchestration: the current hooks page excludes plugin command hooks from Work Cloud
orchestration even when execution is local. Report that capability gap and use skill references
or the repository instruction fragment for static guidance.

OpenAI now documents root `plugin.json` with `extensions.com.openai`, and explicitly supports
the existing `.codex-plugin/plugin.json` fallback. Keep the supported fallback for this release.
ADR 0002 is evidence about 0.153.4, not proof that today's portable format is broken. A future
manifest migration needs a host-delivery probe on the supported versions before removing that
regression guard; metadata validation alone cannot establish delivery.

Skill discovery is token-budgeted and configurable through `skills.max_context_tokens`
(documented maximum 10,000). Studio's 6,500-character description cap is its own conservative
packaging budget, not a Codex platform limit. Keep selective reference loading regardless of
the available context window.

**Generated agents inherit by default.** Without a routing file, the generator drops the Claude
role label and emits neither `model` nor `model_reasoning_effort`; the parent session decides.
Codex custom-agent files accept both fields. A user-owned mapping passed through `--routing`
can assign a suitable Codex model and effort to each role class without putting provider IDs in
the shared plugin. See `model-routing.md`.

## The prompt shape Codex documents, and what the studio already supplies

OpenAI's guidance asks a user prompt to carry four things: **goal, context, constraints, and
how to verify**. Three of the four are what this plugin *is* — the skills carry the method, the
`rules/` files carry the constraints, and the verdict vocabulary carries "done when". A user
invoking `/implement-change --mode implement` or `/review-work --mode diff` should only need to supply the goal and point at the code.

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

Codex ships `/plan` and `/review-work --mode diff` of its own. They are good and they are generic; the studio's
are Rust-specific and end in a gate verdict with evidence attached. The overlap is worth naming
in the skill descriptions rather than pretending it isn't there:

- Codex `/plan` gathers context and asks clarifying questions → studio `/design-change --mode explore` compares
  approaches, `/design-change --mode specification` writes the shared contract and runs fresh Goldfish review, and
  `/implement-change --mode plan` orders the work. Authorized implementation continues through fresh
  artifact reconstruction and integration under `references/elephant-workflow.md`; an
  explicit design-only request stops at its artifact. Missing host isolation is unverified.
- Codex `/review-work --mode diff` diffs against a base branch → studio `/review-work --mode diff` runs the maintainer-bar
  checklist, the oracle-weakening checks, and the gate lenses, and returns
  COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED.
- OpenAI suggests pointing `AGENTS.md` at a `code_review.md` so review behavior is consistent
  across repos. On this plugin that file is `/review-work --mode diff` plus `verdicts.md`; a repo that wants
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
- **Use worktrees for parallel work.** `/maintain-project --mode worktrees` exists for this; running concurrent
  agents over one working tree is how two changes overwrite each other.
- **Prove a workflow by hand before scheduling it.** Applies to any of the studio's skills
  wired into a scheduled task.

## What deliberately did NOT change

- No Codex model name, reasoning-effort level, sandbox mode, or approval policy is set by this
  plugin. Those are session-level user choices.
- The role/profile roster, the gates, and the verdict vocabulary are identical on both hosts. Only
  the delivery surface differs — `sub-agents.md` covers the inline fallback where a host has no
  sub-agents at all.
