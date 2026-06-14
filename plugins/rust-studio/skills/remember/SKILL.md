---
name: remember
description: "remember save capture learning — persist a project learning so the studio recalls it across sessions: an architecture decision, a gotcha, a convention, or a non-trivial fix. Writes an Obsidian-idiomatic note to a single shared vault (via the obsidian MCP) and links it from the project index."
argument-hint: "[what to remember]"
user-invocable: true
---

# /remember — capture a project learning

Persist a learning so future sessions start with it. Notes live in one Obsidian vault under a
per-project folder, written through the **obsidian** MCP, so every session — and `/recall` —
retrieves from the same place. Companion to `/recall` and `/session-wrap`.

## Where notes live (resolve every time)
- **Vault root:** `$OBSIDIAN_VAULT_PATH`, default `~/memory` (cross-platform — never hardcode a path).
- **Project folder:** `<vault>/projects/<project>/`, where `<project>` is the basename of the
  session cwd (for a repo at `…/nebula`, that is `nebula`). The skill owns this flat layout: notes
  are `<vault>/projects/<project>/<kebab-slug>.md`; the index is `<vault>/projects/<project>/MEMORY.md`.
  Create the folder + index on first write if absent. No subfolders, no registry, no external skill
  required — just the vault + the obsidian MCP.

## What to capture (and what not to)
Capture what is **non-obvious and durable**: a decision and its rationale, a gotcha that cost
time, a convention the codebase follows, a non-trivial fix, or a durable external pointer. Do
**not** capture what the code, git history, or `Cargo.toml` already makes obvious, or anything
specific to one session.

## Steps
1. **Distil** `$ARGUMENTS` (and recent context) into ONE atomic learning — a short plain-English
   title and a body of one or two factual paragraphs. Pick a `note_type`:
   `decision` | `gotcha` | `convention` | `fix` | `reference` | `concept`.
2. **Dedup-check before writing.** Search the project folder for the same topic — **`search_semantic`
   first** (it finds the note even when the wording differs; ask for a small `top_k`, ~5), then
   `search_metadata` to filter by `note_type`/tag. If a matching note exists, **update it** rather
   than duplicate: `note_patch` / `note_insert` to extend the body, and re-`note_write` (or
   `note_patch`) the frontmatter `updated` date. State the choice and proceed.
   - If `search_semantic` is unavailable (embeddings off), fall back to `search_text` (request a
     small result window — never consume an unbounded dump) and the harness **Grep** over
     `<vault>/projects/<project>/`.
3. **Write the note** with `note_create` at `<vault>/projects/<project>/<kebab-slug>.md`.
   Put the YAML frontmatter **inline at the top of the note body** (the MCP's separate `frontmatter`
   parameter does not reliably write a block, so the note would end up untyped and invisible to
   `search_metadata`):

   ```markdown
   ---
   title: "<Exact Title>"
   tags: [<note_type>, <area-or-crate>]
   note_type: <decision|gotcha|convention|fix|reference|concept>
   status: active
   created: <YYYY-MM-DD>
   updated: <YYYY-MM-DD>
   ---

   <The fact, why it holds, where it applies (crate/module/file as inline `code`, not a link),
   and the takeaway. Link related notes generously with [[note-name]] wikilinks — every concept or
   sibling learning that has, or should have, a note.>
   ```
4. **Link it from the index.** `note_insert` (or `note_patch`) a one-line pointer onto
   `<vault>/projects/<project>/MEMORY.md` (create it with a `# <project> — project memory` header if
   absent): `- [[<kebab-slug>|<Title>]] — <one-line hook ≤140 chars>`.
5. Confirm what was saved and where. **COMPLETE**.

## Notes
- Use **only real** obsidian MCP tools: `search_text`, `search_metadata`, `search_semantic`,
  `note_create`, `note_read`, `note_write`, `note_patch`, `note_insert`, `wikilinks`, `frontmatter`.
- Atomic — one concept per note; filename = the concept's plain-English name (no date prefix).
- Source/file references → inline `code`, never markdown links (path links pollute the graph).
- Recall later with `/recall <topic>`; the project `MEMORY.md` is the at-a-glance index.
- **Graceful degrade:** if the obsidian MCP is not available, write the same note + index line to
  the same vault paths with the harness **Write** tool — the store is the markdown vault either way.
