# 0002 — The Agent Plugins 1.0 manifest is withdrawn, because it silences every Codex hook

**Status:** accepted, 2026-09-07. Supersedes the F6 finding in
[`0001-agent-skills-research-2026-09.md`](0001-agent-skills-research-2026-09.md), which recorded
shipping a root `plugin.json` as a closed win.

## Context

The plugin shipped three manifests: `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
and a root `plugin.json` declaring
`$schema: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. The third was added as
"one more door" for clients implementing the cross-vendor standard.

For two sessions the studio appeared broken on Codex: skills and agents installed and loaded,
but no session briefing reached the model and no path-scoped standard arrived on a file read.
Codex printed `hook: SessionStart Completed` and kept `trusted_hash` entries for all eight
handlers, so the hooks looked live. They were not: a hook patched to write a marker file on
entry never wrote it, and `RUST_LOG=trace` showed every executed hook carrying
`hook.source="user"`. The host's own plugin panel said it plainly: **"Hooks — No plugin hooks."**

## Decision

**Delete the root `plugin.json` and keep it deleted**, guarded by `RS-MANIFEST-058`.

## What was measured

Codex CLI 0.153.4, marker-file probe, one run each:

| root `plugin.json` | hooks execute |
|---|---|
| absent | **yes** |
| present, no `$schema` | **yes** |
| present, with `$schema` | no |
| present, `$schema` + a `hooks` key | no |
| present, `$schema` + default-discovery `hooks/hooks.json` | no |
| present, `$schema` + `extensions["com.openai"]` / `["com.openai.codex"]` | no |

Ruled out separately, each by experiment rather than reasoning: `hookEventName` casing,
`enabled = true` in `[hooks.state]`, a `plugin_hooks` feature flag, hook trust (via
`--dangerously-bypass-hook-trust`), and the interactive TUI, which behaves exactly like
`codex exec`.

## Why there is no compliant way to keep both

The Agent Plugins 1.0 schema lists `required: ["$schema", "name"]` and sets
`additionalProperties: false`. `$schema` is what flips Codex onto the path that drops hooks, and
it cannot be omitted; `hooks` cannot be added. The standard's `extensions` escape hatch —
"client-specific manifest data keyed by reverse-domain extension namespace" — is not read by
Codex for hooks under either namespace tried.

Upstream, [openai/codex#16430](https://github.com/openai/codex/issues/16430) reports the same
class of failure and locates it in Codex's own source: `plugins/manifest.rs` parses skills, MCP
servers and apps and omits hooks. On 0.153 the `.codex-plugin` path works; the Agent Plugins
path still does not.

## Consequences

- Every Codex hook works again: session briefing, path-scoped standards, sub-agent brief,
  routing nudge, rustfmt nudge, pre-compaction warning.
- Clients implementing Agent Plugins 1.0 lose the direct manifest install. They still get all
  62 skills via `npx skills add`, which reads the flat `skills/` directory and needs no
  manifest. This project's own hosts are Claude Code and Codex, so the trade is one-sided.
- The claim is falsifiable and cheap to re-test: patch the installed cache's `session-start.ts`
  to write a marker on entry, run one `codex exec`, and look for the file. Restore the manifest
  the moment that probe passes with it present.
