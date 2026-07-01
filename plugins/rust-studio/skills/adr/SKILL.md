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

**Maintainer bar applies.** Options are weighed against the maintainer-grade standard
(`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`): reuse over reinvent, structural
invariants over caller discipline, and a forward view. The Pre-code Maintainer Gate (Phase 2.5)
runs before the decision is taken.

Default is **autonomy: decide and proceed.** Escalate to the user only at genuine
forks (option selection) and before the irreversible write.

## Input

`$ARGUMENTS` is the decision title or topic. If empty, ask: "What decision do we
need to record?" If the decision is entangled with a larger design, suggest running
`/architecture` or `/brainstorm` first.

## Phase 1 — Gather context

**Recall first:** `/recall <decision topic>` (or reuse the session-start memory index if it
already surfaced this area) — search for prior or conflicting decisions before writing a new ADR,
and carry them into the context and options; say when a recalled note changes the approach. If
nothing surfaces, proceed (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).

1. Restate the decision in one sentence. Confirm it is scoped to one choice, not a
   design doc.
2. Spawn **`rust-scout`** (read-only) to:
   - List `docs/adr/` using Glob / `fd` and identify the highest-numbered
     `NNNN-*.md` file to determine the next sequence number.
   - Note any code, tests, or `Cargo.toml` sections that bear directly on the
     decision area (use serena `get_symbols_overview` for
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
   - **(a) Invariants & encoding** — the invariants the option upholds and HOW they are
     structurally encoded (newtype / enum / typestate / sealed trait / RAII), not by caller
     discipline,
   - **(b) Failure modes / abuse cases** — how it fails and is misused; **mandatory** when the
     decision touches untrusted input or a cross-crate trust boundary,
   - **(c) Forward view** — the 2-year / 3-extension picture: after three likely extensions,
     does responsibility still sit in the right crate? Not just a one-line trade-off,
   - any gate triggered (`SAFETY-GATE`, `API-GATE`, …).
   - **Freshness (cite-or-declare-version):** when the decision depends on ecosystem behavior
     (a crate's API shape, adoption pattern, RUSTSEC posture), cite the docs.rs / release-notes /
     source you checked via exa MCP (`web_search_exa` / `web_fetch_exa`) — or a crate-docs MCP
     (cratesio/context7/rust-docs) if one is configured — OR state the last-verified version. Silence is a gap, not a pass.
   - For a boundary-moving / cross-crate / new-primitive decision, spawn **`harsh-critic`** by
     DEFAULT to attack the recommended option (premise, failure modes, radically different
     decomposition) and fold real findings into the options before the gate.
5. **Pre-code Maintainer Gate:** `chief-architect` emits a **Maintainer-grade pre-code verdict**
   per `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md` — `ACCEPTABLE` /
   `RESHAPE NEEDED` / `BLOCKED`: what crate owns the concept; which sibling primitives already
   exist (reuse vs. reinvent); what a strict maintainer would reject; which breaking changes
   active dev permits. `RESHAPE NEEDED` reworks the options before the user is asked; `BLOCKED`
   surfaces the missing prerequisite. Record the verdict in the ADR's Context.
6. **`AskUserQuestion`**: present the options table and ask which to proceed with.
   If the user is undecided, ask `chief-architect` for a recommendation with
   rationale — but **the user makes the final call**.

## Phase 3 — Decision

7. Record the chosen option and the deciding rationale. Note what was explicitly
   rejected and why, so future readers understand the road not taken.

## Phase 4 — Draft

8. Fill in the ADR template (`${CLAUDE_PLUGIN_ROOT}/docs/templates/adr.md`) with:
   - **Status** — `Proposed`.
   - **Context** — forces and constraints that made this decision necessary.
   - **Decision** — the chosen option, stated plainly.
   - **Consequences** — what becomes easier, what becomes harder, new constraints
     introduced. Be direct about downsides; do not spin.
   - **Alternatives** — rejected options and the reason each was ruled out.

## Phase 5 — Approve and write

9. Terminal "here's the plan — file it?" gate: present the complete ADR draft for the
   user to approve using native plan mode (on approval the user transitions into an edit
   mode and the write proceeds). Keep `AskUserQuestion` for the earlier option fork (the
   Phase 2 option selection), not for this final approval. Loop back to Phase 4 for any
   requested changes.
10. On approval, resolve the output path:
    - Sequence number = highest existing `docs/adr/NNNN-*.md` + 1, zero-padded to
      four digits.
    - Slug = title lowercased, spaces → hyphens, punctuation stripped.
    - Final path: `docs/adr/<NNNN>-<slug>.md` (relative to project root).
11. Delegate the write to **`rust-builder`** with the approved content and resolved
    path. Do not call Write/Edit yourself.
12. Update **Status** to `Accepted` if the decision is final (if ambiguous from the
    approval, ask once; otherwise default to `Accepted` when the user approved).

## Output

Summarize: the decision recorded, the path written, gates or leads to notify (e.g.
`api-design-lead` if the decision affects the public API), and any follow-on work.
**Persist what settled:** `/remember` the ADR's one-line decision as a vault note pointing at the
ADR file path (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
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
