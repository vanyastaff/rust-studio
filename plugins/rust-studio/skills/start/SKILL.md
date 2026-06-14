---
name: start
description: "start, onboard, begin — orient into the Rust Code Studio: detect the project stack, explain the team and protocol, and route to the right next skill."
argument-hint: "[optional: what you want to do]"
user-invocable: true
---

# /start — onboard into the studio

Orient and route. Keep it short and concrete.

## Steps
1. **Detect the project.** Use serena `find_file` / `list_dir` to locate `Cargo.toml`
   (workspace or single-crate), then `get_symbols_overview` on key modules to classify
   the domain: library, async/web, CLI, systems/embedded. Use `rg` to confirm feature
   flags or `cfg`-gated targets serena can't resolve. If there's no `Cargo.toml`, ask
   whether to scaffold one with `/new-crate`.
2. **Brief the user** in a few lines: the detected stack, which leads/specialists are
   relevant, and how the studio works — **autonomy-first quality loop**: tactical calls
   are decided and executed; `AskUserQuestion` is reserved for direction forks,
   irreversible actions, and outward steps (push, PR, publish).
3. **Find out the goal.** `AskUserQuestion` with options matched to the detected domain:
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
