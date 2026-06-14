---
name: scope-check
description: "scope check creep guard — compare diff or plan against acceptance criteria, flag over-scope / under-scope, and surface a verdict via product-steward."
argument-hint: "[story/plan]"
user-invocable: true
---

# /scope-check — guard a change against its stated scope

Compare the actual diff (or plan) against the acceptance criteria for the story and produce
a clear verdict: in-scope, over-scope, or under-scope. You are the orchestrator — you read
diffs and surface findings; **you do not write files yourself — delegate any remediation to
`rust-builder` via `/dev-task`.** Honor the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

## Input

`$ARGUMENTS` is the story, plan text, or a path to a story/plan file. If empty, or if a git
ref is also needed, batch both into a single `AskUserQuestion` before proceeding.

## Phase 1 — Gather context

1. Resolve the acceptance criteria. If `$ARGUMENTS` is a path, read that file and extract
   the criteria. If it is inline text, parse them as a bulleted list. If criteria are absent
   or ambiguous, surface what you found and ask the user to confirm or supply them — this is
   a genuine fork; do not guess.
2. Obtain the diff to check. Default: working-tree diff (`git diff HEAD` plus staged
   changes). If the user supplied a ref, use `git diff <ref>`. State exactly what you're
   comparing and why. Use `delta` for readable output where available.

## Phase 2 — Spawn product-steward

3. Spawn **`product-steward`** with the criteria and the diff. Instruct it to:
   - identify every change that was **not** requested by any acceptance criterion (scope
     creep — additions, refactors, renames, dependency bumps not tied to the story),
   - identify every criterion that has **no** corresponding change in the diff (missing
     coverage),
   - note any change that conflicts with or partially contradicts a criterion (mis-alignment).
   - use `rg` to locate specific file:line references in the diff; use serena MCP for symbol
     navigation if resolving a type or trait reference — never Bash `grep`/`find`.
4. `product-steward` returns three lists: **ADDED** (not asked for), **MISSING** (required
   but absent), **MISALIGNED** (present but inconsistent with the criterion). It does not
   propose fixes — only classifies.

## Phase 3 — Present findings (gate)

5. Show the user the three lists in a structured block (see Output format below).
6. For each ADDED item that is non-trivial, present 2–3 options with trade-offs:
   - **keep** — tightly related, low-risk, user endorses it now.
   - **split** — worth doing but belongs in a separate story; `product-steward` drafts the
     new story shell (title + criteria stub) for the user to confirm.
   - **revert** — noise or risk; hand to `rust-builder` via `/dev-task` to remove.
7. `AskUserQuestion`: batch all ADDED items into one ask; get an explicit decision for each
   before any action is taken. This is a direction-changing fork — do not auto-decide.

## Phase 4 — Handle missing coverage

8. For MISSING items, batch all dispositions into one `AskUserQuestion`: for each, should it be:
   - **addressed in this PR** — hand to `rust-builder` via `/dev-task` with the approved
     acceptance criterion as the task; run `/review` afterward.
   - **deferred** — note it as a known gap; `product-steward` may add a follow-on story
     stub if the user requests it.

## Phase 5 — Verdict

9. After all decisions are captured, emit the final scope verdict:

```
SCOPE-CHECK VERDICT
===================
Story / plan: <title or first line of criteria>
Diff source:  <git ref or "working-tree">

ADDED (N items)
  ✗  path:line — <description> → <keep | split → <new story stub> | revert>

MISSING (N items)
  ✗  criterion — <criterion text> → <address in PR | deferred>

MISALIGNED (N items)
  ✗  path:line — <criterion> vs. <what the diff actually does>

VERDICT: IN SCOPE | OVER SCOPE | UNDER SCOPE | MIXED
```

Skip any section with zero items. No padding, no praise.

10. Suggest follow-on steps where appropriate:
    - If anything is being built or reverted → `/dev-task`
    - For a final quality pass after remediation → `/review`
    - If the story itself needs restructuring → re-run `/scope-check` on the revised plan

## Error recovery

If `product-steward` returns **BLOCKED** (criteria unreadable, diff unavailable, story
missing), surface the blocker immediately and `AskUserQuestion` with options:
- (a) supply the missing artifact and retry,
- (b) proceed with the partial information it does have,
- (c) stop.

Never discard partial findings. If some criteria were already classified before the block,
show them and mark the rest as UNREVIEWED.
