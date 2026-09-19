# Model routing

The studio assigns a role class, then the host selects an available model and effort. This keeps
one agent roster usable on Claude, Codex, GLM, and DeepSeek-compatible gateways without treating
their model names or effort scales as interchangeable.

| Role class | Work | Starting effort |
|------------|------|-----------------|
| `haiku` | Read-only locating, formatting, mechanical edits | low or medium |
| `sonnet` | Normal implementation, tests, ordinary reviews | medium |
| `opus` | Security audit, high-risk or unresolved design | high |
| `inherit` | Gate, director, or adversarial lens | the parent session's effort |

Start at the listed class. Escalate after a failed check, material uncertainty, or a larger blast
radius. Do not run the same task through a sequence of stronger models without new evidence.

An explicit per-agent launch override wins over the role definition; the definition wins over a
host's default subagent model; otherwise the worker inherits the parent. A fork keeps the parent
model. Keep these precedence rules in the adapter, not in task prompts.

## Claude Code

The built-in `haiku`, `sonnet`, and `opus` aliases select Claude families. For an
Anthropic-compatible gateway, map every alias it will receive to a model the gateway exposes:

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "<gateway-fast-model-id>",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "<gateway-standard-model-id>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "<gateway-strong-model-id>",
    "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet"
  }
}
```

Put this in the user-owned Claude settings for the gateway profile. If the gateway exposes one
usable model, point all three aliases at that ID and keep `CLAUDE_CODE_SUBAGENT_MODEL` aligned
with it. Configure `CLAUDE_CODE_EFFORT_LEVEL` only when that model advertises compatible effort
levels. Gateway discovery (`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`) is useful after the
gateway restricts its model list; it is not a substitute for explicit aliases.

`CLAUDE_CODE_SUBAGENT_MODEL` is a default. A role's frontmatter or an explicit launch override
takes precedence, so it covers `inherit` workers without flattening the roster. Cap parallel
tool and subagent work with `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` when the account has a strict
spending limit. Do not set it solely because more parallelism exists.

## Codex

Codex custom agents accept `model` and `model_reasoning_effort`, but the generated agents omit
them unless you give the generator a local JSON mapping. Keep it outside the plugin so model IDs
and spending policy remain yours:

```json
{
  "haiku": { "model": "<fast-model-id>", "model_reasoning_effort": "low" },
  "sonnet": { "model": "<standard-model-id>", "model_reasoning_effort": "medium" },
  "opus": { "model": "<strong-model-id>", "model_reasoning_effort": "high" }
}
```

Generate with:

```zsh
node scripts/generate-codex-agents.mjs ~/.codex/agents --routing ~/.codex/rust-studio-routing.json
```

`inherit` stays with the parent model and effort unless the JSON includes an `inherit` entry.
Set `[agents]` defaults in `~/.codex/config.toml` for unclassified workers and cap concurrent
threads there. Explicit model or effort in a generated agent overrides those defaults.

```toml
[agents]
enabled = true
# Add max_concurrent_threads_per_session after measuring the gateway's useful parallelism.
```

Start with the host default, then set the concurrency cap from task traces and the spending
budget. This cap controls parallelism, not which model a role receives.
