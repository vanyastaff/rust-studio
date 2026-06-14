---
name: recall
description: "recall memory decision gotcha convention fix — surface prior project learnings before you work: search the Obsidian vault (via the obsidian MCP) for decisions, gotchas, conventions, and fixes relevant to a topic. Use before implementing in an area, making a decision, or when something feels familiar."
argument-hint: "[topic or area]"
user-invocable: true
---

# /recall — retrieve project memory

Pull relevant past learnings into context so work compounds instead of repeating
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). Companion to `/remember`.

Notes live in one Obsidian vault under a per-project folder, read through the **obsidian** MCP.
The vault root is `C:\Users\vanya\memory`; the project folder is the basename of the session cwd
(for a project at `…/nebula`, that is `nebula`), so the index is
`C:\Users\vanya\memory\<project>\MEMORY.md`.

## Steps
1. If `$ARGUMENTS` is empty, read the project index `C:\Users\vanya\memory\<project>\MEMORY.md`
   with `note_read` and summarize what's there.
2. Otherwise rank-search the vault for the topic, scoped to the project folder:
   - `search_text` for the area/crate/keywords across titles and bodies,
   - `search_tag` and `search_frontmatter` to narrow by tag or `metadata.type`,
   - `links_backlinks` on a strong hit to surface related notes that point at it.
   Rank the union by relevance.
3. Read the matching note(s) with `note_read` and present each as: **title** (type) → the key
   takeaway, with the note path.
4. If nothing matches, say so plainly and suggest capturing one with `/remember` once the
   work is done.

## Output
A short, ranked list of relevant notes with their key takeaways, each linked to its note path.
Lead with the single most relevant learning. Don't pad with marginally-related notes.
