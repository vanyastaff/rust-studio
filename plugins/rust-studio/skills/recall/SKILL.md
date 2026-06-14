---
name: recall
description: "recall memory decision gotcha convention fix — surface prior project learnings before you work: search the shared Obsidian vault (via the obsidian MCP) for decisions, gotchas, conventions, and fixes relevant to a topic. Use before implementing in an area, making a decision, or when something feels familiar."
argument-hint: "[topic or area]"
user-invocable: true
---

# /recall — retrieve project memory

Pull relevant past learnings into context so work compounds instead of repeating
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). Companion to `/remember`.

## Where notes live (resolve every time)
- **Vault root:** `$OBSIDIAN_VAULT_PATH`, default `~/memory` (cross-platform — never hardcode).
- **Project folder:** `<vault>/projects/<project>/`, `<project>` = basename of the session cwd;
  the index is `<vault>/projects/<project>/MEMORY.md`. Read through the **obsidian** MCP.

## Steps
1. If `$ARGUMENTS` is empty, `note_read` the project index `<vault>/projects/<project>/MEMORY.md`
   and summarize what's there (most-relevant first).
2. Otherwise **rank-search the project folder**, semantic-first, and fuse the signals:
   - **`search_semantic`** (PRIMARY) — meaning-based, finds the note even when wording differs.
     Ask for a small `top_k` (~8); never request an unbounded result.
   - **`search_metadata`** — narrow by `note_type` (decision/gotcha/convention/fix/reference/concept)
     or `tags` when the query implies a kind.
   - **`search_text`** — keyword leg. `search_text` here returns an UNRANKED FLOOD; **always** request
     the smallest window the tool supports and keep only the top few — never consume the raw dump.
   - **`wikilinks`** — on the single strongest hit, pull backlinks + outgoing to surface related notes.
   Merge the lists and rank by relevance (a note that several legs agree on ranks highest).
3. `note_read` the few top matches (not the whole neighbourhood) and present each as:
   **title** (`note_type`) → the key takeaway, with the note path.
4. If nothing matches, say so plainly and suggest capturing one with `/remember` once the work is done.

## Graceful degrade
If `search_semantic` errors (the obsidian MCP was built without embeddings) or the MCP is
unavailable, fall back to `search_text` (small window only) plus the harness **Grep** tool over
`<vault>/projects/<project>/` — match titles, tags, and bodies; rank by hit density. Same vault,
lexical-only.

## Output
A short, ranked list of relevant notes with their key takeaways, each linked to its note path.
Lead with the single most relevant learning. Don't pad with marginally-related notes.
