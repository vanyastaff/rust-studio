# Usage telemetry — which skills and agents are actually reached for

The catalog cannot answer this about itself. Sixty-four skills and thirty-three agents ship
with the plugin, and until 0.56.0 the only way to learn which ones anyone used was to mine
the host's session transcripts: 1.7 GB, 1,187 sessions, once. That audit found 22 skills ever
invoked and 42 never, and it could not tell need from noise, because the hook that was meant
to route prompts to skills had spent 93% of its firings on sub-agent notifications. The log
described here is the instrument that answers the question the next time in one command,
with the noise removed.

## What is recorded

One JSON line per invocation, appended to `usage.jsonl` in the plugin's data directory
(`CLAUDE_PLUGIN_DATA` on Claude Code, `PLUGIN_DATA` on Codex, the temp directory where
neither is set):

```json
{"ts":"2026-09-14T20:01:02.003Z","session_id":"…","cwd":"/home/me/proj","kind":"skill","name":"review","invoker":"model"}
```

- `kind` — `skill` or `agent`.
- `name` — the skill or agent, with the plugin's own namespace dropped (`rust-studio:review`
  is `review`). A built-in agent or another plugin's skill keeps its name as given, so the
  report can show where the model went instead of the studio.
- `invoker` — `model` when the Skill or Agent tool made the call, `user` when a person opened
  a prompt with `/name`. A typed skill never passes through the Skill tool, so the two hands
  are logged by two hooks: `usage-log.ts` on `PostToolUse` (matcher `Skill|Agent`) and
  `user-prompt-submit.ts` on the prompt. A skill named mid-prompt is a mention; if the model
  acts on it, the Skill tool logs that call.
- `session_id`, `cwd`, `ts` — enough to count sessions and projects and to window by date.

Nothing else. No prompt text, no arguments, no file paths beyond the working directory. The
file is read by the report and by nothing else, never leaves the machine, and grows by about
a hundred bytes per row. The session-start sweep that removes week-old session markers from
the same directory leaves it alone. To reset, delete it.

## Reading it

```sh
bun "scripts/usage-report.ts"              # last 7 days
bun "scripts/usage-report.ts" --days 30    # wider; --days 0 for the whole log
bun "scripts/usage-report.ts" --json       # one object
```

The script is bundled with `/studio-doctor`, which runs it under `--usage`; in the plugin
checkout it is `hooks/scripts/usage-report.ts`. It prints, per skill and per agent:
invocations split by hand, distinct sessions, and the projects they came from (the working
directory's basename, with `rust-studio` flagged as plugin development). Then the list the
pruning decision needs: every skill and agent on disk that the window never saw. Names in the
log that match nothing on disk are listed separately as "outside the studio".

## The decision rule

Numbers from one week of real sessions decide what happens to a skill, and the rule was
fixed before the week began so the numbers could not be read to taste:

- **At least one genuine invocation** (model or user, from a project that is not the plugin
  checkout) keeps the skill.
- **No invocation, and no demand**: the audit's scan of what users asked for found nothing
  the skill serves, or found it served by native git, by an agent, or by another skill. The
  skill is deleted. Deleted, not demoted: a skill nobody reaches for costs its description in
  every session's context.
- **No invocation but demand**: users asked for what the skill does and the model did not
  pick it. The description is the suspect. Sharpen it to say what the skill buys over the
  bare agent (its gates, its evidence, its verdict), add a routing eval in the language the
  prompts actually arrive in, and measure again.

Agents are counted for the same reason but are not on the table: the audit found 23 of 33
spawned, 400 times and more, and the model's default is to spawn one.

## Coverage by host

On Claude Code both hooks run, so skills and agents are logged from both hands. On Codex the
`PostToolUse` event carries `tool_name: "spawn_agent"` with `tool_input.agent_type` (its
payload schema is in the Codex binary), which the hook reads; skills there are files the
model reads rather than a tool it calls, so a Codex week reports agents and typed `/name`
invocations, never a model-picked skill. A report from a Codex-only machine is therefore a
floor for skills, not a count.

## What the regex router taught

The route hint that ran in the prompt hook from 0.44 to 0.55 named a skill whenever a prompt
had the shape of work that skill owned. On synthetic English prompts it measured well. On the
real traffic it fired 123 times, 114 of them on `<task-notification>` text no human typed,
and the model obeyed 6 — and 0 of the 17 times it named `/review`. Ninety percent of the
human prompts were Russian; 73% were under 120 characters; none carried a compiler error, a
panic, a diff or a `-->` location. No prompt-shape router could work on that traffic, and a
hint that fires on noise teaches the model that the hint is noise. Routing now lives in the
skill descriptions and the routing evals under `evals/routing-*`, and this log measures
whether that is enough.
