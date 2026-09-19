---
name: start
description: "Use when starting Rust Code Studio work: detect the stack and route to the right workflow or specialist."
---

# /start — onboard into the studio

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Orient and route. Keep it short and concrete.

## When NOT this skill
- You want the full catalog, not a recommendation for this project → `/help`. `/start`
  detects the stack and routes to one skill; it does not list everything (see Notes below).

## Steps
1. **Detect the project.** Locate `Cargo.toml` (workspace or single-crate) with Glob and read
   it; classify the domain (library, async/web, CLI, systems/embedded) from the manifest,
   directory shape, and `get_symbols_overview` on key modules when the language-server layer
   is available (harness `LSP` tool or serena). Use `rg` to confirm feature
   flags or `cfg`-gated targets the language server can't resolve. If there's no `Cargo.toml`, ask
   whether to scaffold one with `/new-crate`.
2. **Brief the user** in a few lines: the detected stack, which leads/specialists are
   relevant, and how the studio works — **autonomy-first quality loop**: tactical calls
   are decided and executed; a user prompt is reserved for direction forks,
   irreversible actions, and outward steps (push, PR, publish).
3. **Find out the goal.** Prompt the user with options matched to the detected domain:
   - "Design / change a public API" → `/team-api` or `/design-api`
   - "Build an async service feature" → `/team-async`
   - "Make it faster / safer" → `/team-perf`
   - "Implement a specific task" → `/dev-task`
   - "Review my current changes" → `/review`
   - "Prepare a release" → `/team-release`
   - "Just explore the codebase" → spawn `rust-scout`
4. **Route** to the chosen skill, passing along what you learned.

## Notes
- Don't dump the whole catalog here — that's `/help`.
- The session-start hook already printed a stack summary; build on it, don't repeat it.
