---
name: session-wrap
description: "session wrap summary commit PR memory — close a work session: recap what changed, capture durable learnings into project memory, and hand off a clear next step so context compounds instead of evaporating."
argument-hint: "[optional: focus note]"
user-invocable: true
---

# /session-wrap — close the session cleanly

Turn a session's work into a short record and a clear next step, so the next session (yours
or a teammate's) starts ahead. Ties the memory system (`/remember`, `/recall`) into a ritual.

## Steps
1. **Summarize** — read `git diff`/`git log` for this branch; recap in a few bullets: what
   changed, what's done, what's still open or BLOCKED.
2. **Capture learnings** — identify anything **non-obvious and durable** worth keeping (a
   decision + rationale, a gotcha, a convention discovered). For each, run `/remember`
   directly — it writes the note into the Obsidian vault via the `obsidian` MCP; note the
   resulting note path in the output. Skip what the code, git history, or `Cargo.toml` already
   make obvious.
3. **State of play** — list done / in-progress / blocked with the next action for each open
   item. If a spec is active (`.rust-studio/specs/`), update its task
   statuses.
4. **Suggest the next step** and offer to run it:
   - Uncommitted work that's coherent → `/commit` (then `/pr`).
   - A spec's tasks all done → `/spec-verify`.
   - User-facing change → `/changelog`.
   - Loose ends → the specific skill (`/review`, `/fix-build`, `/test-plan`, …).
5. No destructive actions on the way out — no force-push, no `--no-verify`.

## Output
A tight recap (changed / done / open), the learnings captured (with their vault note paths), and
the recommended next step. Keep it short — this is a handoff note, not an essay.
