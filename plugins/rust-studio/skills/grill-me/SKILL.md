---
name: grill-me
description: "grill me, interview me, pull my input, stress-test the plan, extract requirements — when a decision genuinely needs YOUR input, the agent interviews you in cheap one-at-a-time questions (each with a recommended default) instead of dropping one heavy future-deciding fork. Sources from the code first; asks only what truly lives in you."
argument-hint: "[plan, decision, or area to pull your input on]"
user-invocable: true
---

# /grill-me — extract the user's input in cheap increments, not one heavy fork

The job is to reach **shared understanding** of a plan or decision by interviewing the user with
**small, concrete questions asked one at a time, each with a recommended default** — the inverse
of dropping a single multidimensional "what should we do long-term about X?" question the user has
to study to answer. You facilitate per the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §1, *Never offload your own analysis as a
question* + *ask grill-me-style*). Adapted from the grill-me productivity skill: relentless but
cheap; the agent does the analysis, the user supplies only what's genuinely theirs.

Use this when:
- the user says "grill me", "interview me", "pull my input", "stress-test this plan"; **or**
- you (an orchestrating skill/agent) realize a plan has a real fork whose answer lives in the
  **user**, and you want to extract it without handing them a heavy essay-prompt.

## The core discipline (read before asking anything)

1. **Decide what you can; ask only what's the user's.** A question is warranted only when the
   answer lives in the user — taste, product priority, risk appetite, willingness to break an
   API, a true business/deadline constraint. Anything resolvable by analysis, Rust best practice,
   or reading the code is a **tactical call you make**, not a question. If you've researched it
   and have a defensible answer, that's not a question — it's a decision to state.
2. **Source from the code first.** Before asking a hypothetical, look. Use **serena MCP**
   (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`) or spawn **`rust-scout`**
   to answer it from the codebase. Ask the user only what the code genuinely cannot tell you.
   "I checked X and it already does Y, so I'll assume Z — correct?" beats "how should X work?".
3. **Cheap to answer, every time.** A good question is answered by picking the default or
   correcting one axis. If answering would cost the user more than resolving it cost you, you're
   offloading — go back to step 1 and decide it yourself.

## Phase 1 — Map the decision tree (no questions yet)

1. Restate the plan/decision in one sentence. Spawn **`rust-scout`** (or use serena directly) to
   map the affected types, traits, call sites, and constraints. Note the MSRV, async/sync posture,
   public-API exposure, and any sibling-crate ownership relevant to the decision.
2. Build the **decision tree**: list every fork the plan contains, and for **each** mark:
   - **DECIDE** — you can resolve it (analysis / best practice / the code answers it). Write your
     answer + one-line rationale. These will be *stated*, not asked.
   - **ASK** — the answer truly lives in the user (taste / priority / risk / breaking-change
     appetite / business constraint). These become questions.
   - **DEPENDS** — only becomes an ASK depending on an earlier answer; defer it.
3. If everything is DECIDE, **say so and don't run the interview** — present your decisions with
   rationale and a single "veto anything?" gate. Interviewing when you already know the answers is
   the exact anti-pattern this skill exists to replace.

## Phase 2 — Interview (one question at a time)

4. Walk the ASK list in dependency order. For **each**, make **one** `AskUserQuestion` call with:
   - a single focused question (one axis — never bundle unrelated forks into one screen);
   - 2–4 **concrete** options, the **first marked `(Recommended)`** — your default with a
     one-line reason;
   - a one-line **"cost if wrong"** in the option descriptions so the stakes are visible cheaply;
   - (the user can always type *Other* — leave room for that, don't force a false binary).
5. **Resolve dependencies progressively.** Each answer may settle, add, or remove later forks —
   re-derive the remaining ASK list after every answer. Fold any fork an answer just made obvious
   into DECIDE; surface any DEPENDS it just activated.
6. **Keep deciding as you go.** The moment an answer lets you resolve something, resolve it and
   say so — don't re-ask what you can now infer. Narrate decisions made, not a stream of questions.
7. Batch is allowed **only** for genuinely independent, equally-cheap questions (≤3) that don't
   depend on each other — otherwise one at a time so each answer informs the next.

## Phase 3 — Shared understanding

8. Stop when the ASK list is empty — **shared understanding reached**. Produce a short synthesis
   (plain prose, ≤ 200 words):
   - the decisions **you** made (with one-line rationale each),
   - the decisions **the user** made (with their answer),
   - any remaining assumptions/risks, labeled,
   - the maintainer-bar implications carried forward (gate exposure, breaking-change posture).
9. Present the synthesis as the approval gate: "here's the shared understanding — proceed?" Use
   native plan mode for this final go-ahead, not another `AskUserQuestion`.

## Handoff

After approval, suggest and offer to invoke the natural next step (confirm before starting):
- **Needs a durable spec** → `/spec` (the synthesis seeds the spec's context and approaches).
- **Public API surface** → `/design-api` or `/team-api`.
- **Cross-crate / architectural** → `/architecture` (ADR + boundaries with `chief-architect`).
- **Ready to build** → `/dev-task`.

## Constraints

- **No files written by this skill**, and no source edits — this is pure elicitation. Capture, if
  any, goes through the downstream skill (`/spec`, `/architecture`) after approval.
- Never present a quality menu — option sets vary by **scope or approach**, never by quality
  (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` §1). The Recommended option clears the bar.
- If `$ARGUMENTS` is already well-understood or trivial, say so and skip to the decision rather
  than manufacturing an interview — over-processing a clear call is its own failure.
- Don't ask the user to do your analysis. If a question would make them reconstruct what you
  already worked out, you've inverted the skill — decide it and state it instead.
