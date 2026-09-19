---
name: start
description: "Use to orient an unfamiliar Rust project and choose its next workflow."
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
   flags or `cfg`-gated targets the language server can't resolve. Without `Cargo.toml`, route
   supplied Rust code to `/review`, a design question to `/brainstorm` or `/architecture`,
   and an explicit project-creation request to `/new-crate` if available. Ask for a project
   path only when the task requires a checkout that has not been located.
2. **Brief the user** in a few lines: the detected stack, which leads/specialists are
   relevant, and how the studio works — **autonomy-first quality loop**: tactical calls
   are decided and executed; a user prompt is reserved for direction forks,
   irreversible actions, and outward steps (push, PR, publish).
3. **Use the stated goal.** Route directly when the request already identifies the work.
   Ask a focused question only when the goal is missing or materially ambiguous. Match it
   to the detected domain:
   - "Design / change a public API" → `/design-api`, then `/dev-task`
   - "Build an async service feature" → `/dev-task` with the needed async specialists
   - "Make it faster / safer" → `/perf`, `/audit-unsafe`, or `/dev-task`
   - "Implement a specific task" → `/dev-task`
   - "Review my current changes" → `/review`
   - "Prepare a release" → `/publish` with the required release checks
   - "Just explore the codebase" → spawn `rust-scout`
4. **Route** to the chosen available skill, passing along what you learned. Resolve names
   against the host catalog: `/review` here means Rust Studio review. When names collide,
   use the advertised qualified name (for example `rust-studio:review`) or exact skill path.
   Honor explicit-only invocation rules; when a destination cannot be invoked, explain the
   next action instead of silently substituting an unrelated skill.

## Notes
- Don't dump the whole catalog here — that's `/help`.
- The session-start hook already printed a stack summary; build on it, don't repeat it.
