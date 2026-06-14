---
name: adr
description: "ADR / architecture decision record — write, number, and file a decision record using the studio template: context, options, decision, consequences, alternatives."
argument-hint: "[decision title]"
user-invocable: true
---

# /adr — write an Architecture Decision Record

Produce a focused, honest ADR through **question → options → decision → draft →
approval**, honoring the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You are the orchestrator:
**you do not write files directly — delegate the final write to `rust-builder`.**

Default is **autonomy: decide and proceed.** Escalate to the user only at genuine
forks (option selection) and before the irreversible write.

## Input

`$ARGUMENTS` is the decision title or topic. If empty, ask: "What decision do we
need to record?" If the decision is entangled with a larger design, suggest running
`/architecture` or `/brainstorm` first.

## Phase 1 — Gather context

1. Restate the decision in one sentence. Confirm it is scoped to one choice, not a
   design doc.
2. Spawn **`rust-scout`** (read-only) to:
   - List `docs/adr/` using Glob / `fd` and identify the highest-numbered
     `NNNN-*.md` file to determine the next sequence number.
   - Note any code, tests, or `Cargo.toml` sections that bear directly on the
     decision area (use serena `get_symbols_overview` / `search_for_pattern` for
     symbol-level context; `rg` for cfg-gated / macro-generated sites).
   - Collect any linked tickets, PRs, or discussions the user has already shared
     in `$ARGUMENTS`. Do not ask for more context before scouting.
3. Spawn **`chief-architect`** to surface key forces — constraints, non-negotiables,
   quality attributes — and flag any related ADRs or `ARCH-GATE` concerns.

## Phase 2 — Options

4. With `chief-architect`'s input, assemble 2–4 candidate options. For each:
   - one-line summary,
   - concrete pros and cons (not platitudes),
   - trade-offs for this codebase (performance, `unsafe`, API surface, async
     topology, MSRV, edition 2024 compatibility, etc.),
   - any gate triggered (`SAFETY-GATE`, `API-GATE`, …).
   - For external prior-art or crates.io adoption data, use exa MCP
     (`web_search_exa` / `get_code_context_exa`).
5. **`AskUserQuestion`**: present the options table and ask which to proceed with.
   If the user is undecided, ask `chief-architect` for a recommendation with
   rationale — but **the user makes the final call**.

## Phase 3 — Decision

6. Record the chosen option and the deciding rationale. Note what was explicitly
   rejected and why, so future readers understand the road not taken.

## Phase 4 — Draft

7. Fill in the ADR template (`${CLAUDE_PLUGIN_ROOT}/docs/templates/adr.md`) with:
   - **Status** — `Proposed`.
   - **Context** — forces and constraints that made this decision necessary.
   - **Decision** — the chosen option, stated plainly.
   - **Consequences** — what becomes easier, what becomes harder, new constraints
     introduced. Be direct about downsides; do not spin.
   - **Alternatives** — rejected options and the reason each was ruled out.

## Phase 5 — Approve and write

8. **`AskUserQuestion`**: show the complete draft and ask for approval. Loop back
   to Phase 4 for any requested changes.
9. On approval, resolve the output path:
   - Sequence number = highest existing `docs/adr/NNNN-*.md` + 1, zero-padded to
     four digits.
   - Slug = title lowercased, spaces → hyphens, punctuation stripped.
   - Final path: `docs/adr/<NNNN>-<slug>.md` (relative to project root).
10. Delegate the write to **`rust-builder`** with the approved content and resolved
    path. Do not call Write/Edit yourself.
11. Update **Status** to `Accepted` if the decision is final (if ambiguous from the
    approval, ask once; otherwise default to `Accepted` when the user approved).

## Output

Summarize: the decision recorded, the path written, gates or leads to notify (e.g.
`api-design-lead` if the decision affects the public API), and any follow-on work.
End with **COMPLETE / NEEDS WORK / BLOCKED**.

Suggest next steps if relevant: `/dev-task` to implement the decision, `/review` to
audit code that motivated the ADR, or `/architecture` for broader structural questions.

## Error recovery

If `rust-scout` finds no `docs/adr/` directory, start the sequence at `0001` and
note that the directory will be created. If `chief-architect` returns **BLOCKED** on
a missing prerequisite (e.g. an upstream decision not yet made), surface it with
`AskUserQuestion` and offer: (a) proceed with explicit assumptions documented in the
ADR, (b) defer until the blocker is resolved, or (c) split into two ADRs. Never
discard a draft in progress.
