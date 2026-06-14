---
name: remember
description: "remember save capture learning — persist a project learning so the studio recalls it across sessions: an architecture decision, a gotcha, a convention, or a non-trivial fix. Writes a structured note to the Obsidian vault (via the obsidian MCP) and updates that project's MEMORY.md index."
argument-hint: "[what to remember]"
user-invocable: true
---

# /remember — capture a project learning

Persist a learning so future sessions start with it. Notes live in one Obsidian vault under a
per-project folder, written through the **obsidian** MCP. The harness native auto-memory injects
that project's `MEMORY.md` at session start, so a captured pointer surfaces automatically.

The vault root is `C:\Users\vanya\memory`. The project folder is the basename of the session
cwd (for a project at `…/nebula`, that is `nebula`), so notes land in
`C:\Users\vanya\memory\<project>\` and the index is `<project>\MEMORY.md`.

## What to capture (and what not to)
Capture what is **non-obvious and durable**: a decision and its rationale, a gotcha that cost
time, a convention the codebase follows, a non-trivial fix. Do **not** capture what the code,
git history, or `Cargo.toml` already makes obvious, or anything specific to one session.

## Steps
1. **Distil** `$ARGUMENTS` (and recent context) into one learning — a short title and a body of
   one or two factual paragraphs. Pick a `metadata.type`:
   - `project` — ongoing-work facts: a decision, a gotcha, a convention, a fix.
   - `reference` — a durable pointer to an external doc, tool, or library shape.
2. **Check for a near-duplicate** before writing. Search the vault with `search_text` (and
   `search_frontmatter` to filter by `type`) over the project folder for the same area/topic. If
   a matching note exists, **update it** rather than duplicate — `note_patch` or `note_append`
   to extend the body, `frontmatter_set` to adjust metadata. State the choice and proceed.
3. **Write the note** with `note_create` into `C:\Users\vanya\memory\<project>\<kebab-slug>.md`
   using the harness frontmatter schema:

   ```markdown
   ---
   name: <kebab-slug>
   description: <one-line summary>
   metadata:
     type: project | reference
   ---

   <body — the fact, why it holds, where it applies, and the takeaway. Link related notes
   with [[name]] wikilinks.>
   ```
4. **Append a pointer** to that project's index with `note_append` on
   `C:\Users\vanya\memory\<project>\MEMORY.md`:
   `- [<Title>](<kebab-slug>.md) — <one-line hook>`
5. Confirm what was saved and where. **COMPLETE**.

## Notes
- Keep notes short and factual; link related ones with `[[name]]` wikilinks.
- Recall later with `/recall <topic>`; the project `MEMORY.md` also loads at session start.
