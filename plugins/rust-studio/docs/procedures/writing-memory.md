# Capture an authorized learning

Apply `references/memory-protocol.md` for capture policy and host instructions for the
permitted write mechanism. Memory writes require user/host authorization; a discovered
learning or another operation's closing step does not grant it. If the host requires update
proposals in a separate directory, write only that proposal under its format. Preserve the
host-owned store rather than applying the direct-store mechanics below. Without authority,
return the proposed learning without persisting it.

## Distill and locate

Capture only non-obvious durable decisions with rationale/rejected alternatives, gotchas,
conventions, non-trivial fixes or external pointers. Exclude secrets, transient status and
facts already obvious in code, history or manifests. External facts remain sourced reference
notes until repository evidence establishes a project fact. Keep one concept per note, one
or two factual paragraphs, an at-most-80-character title and a concept-named kebab slug without
a date prefix. Use absolute dates and link related notes.

Resolve the store on each write through `references/procedures/context-recall.md`, honoring
host instructions and supported overrides. In a permitted flat store, notes are
`<store>/<slug>.md`, index is `<store>/MEMORY.md`, and retired notes are under archive.
Search the index and note bodies for title words, subject paths and symbols. Update an
existing subject note and its hook instead of duplicating it. State the choice.

## Direct-store format

When the host permits this format, write frontmatter with name, description (hook at most
140 characters), and metadata:

- type: user, feedback, project or reference;
- kind: decision, gotcha, convention, fix, reference or concept;
- status: active;
- evidence: supporting path, commit, PR, issue or URL;
- verified: the actual YYYY-MM-DD verification date.

The host owns modified and origin-session stamps. The body states the fact, scope, why it
holds, relevant paths/symbols and rejected choices or recovery steps. Use the host's own
format where it differs.

Create the index with `# Memory index` on a first authorized write. Add or update one
`- [Title](slug.md) - <hook>` line. Check the host's actual load budget; the shared Claude
format loads the first 200 lines / 25 KB, with 170 lines the audit threshold. Report pressure
and perform only authorized consolidation instead of blindly appending. Review-work memory
can assess budget, stale notes and promotion candidates without modifying them.

## Verify and finish

Check index/file correspondence: every indexed note exists and every active note has an
index entry. Under authorized direct-store maintenance, restore missing index entries;
report dangling links and preserve them for explicit resolution rather than silently deleting
them. Verify changed content and hook agree. Host proposal-only stores report the proposal
path without claiming canonical memory was updated.

Conventions held for 30+ days may belong in versioned project instructions; propose the
proper owner rather than automatically editing rules. Worker `MEMORY:` lines are candidate
learnings, persisted by the coordinator only within authorization. Historical agent rulings
remain readable without moving their provenance.

Completion means the authorized note/update proposal is written and integrity limits are
reported. In a larger task, fold one line with saved/proposed path or Nothing durable into
the main report before its verdict; bookkeeping is not the deliverable.
