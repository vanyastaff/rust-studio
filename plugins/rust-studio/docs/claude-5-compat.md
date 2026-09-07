# Claude 5 generation compatibility notes

How the studio runs on the current Claude coding models, and the authoring rules that keep it
working there. Grounded in Anthropic's official guidance, re-checked 2026-09-07:

- [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
- [Prompting Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1)
- [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- [Effort](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config)
- [The new rules of context engineering for Claude 5 generation models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models)

The studio stays **model-agnostic** — everything here degrades gracefully on older Opus,
Sonnet, and Haiku sessions. Nothing in the plugin requires a particular model.

## Two current models, and they differ

Opus 5 and Fable 5.1 are both current, and the studio runs on either. Several of their
behaviors point in **opposite** directions, which is why this document prescribes *describing
the outcome you want* rather than hardcoding a correction for one model's default:

| Behavior | Claude Opus 5 | Claude Fable 5.1 |
|---|---|---|
| Progress updates during long tool chains | Narrates readily; per-message output runs long | Writes *fewer* updates than Fable 5; can go quiet for minutes |
| Visible response length | Longer than prior Opus models by default | Denser prose — longer sentences, fewer breaks |
| File edits | — | More likely to rewrite a whole file instead of editing surgically |
| Scope | Can expand a task beyond what was asked | Delivers what's asked and sometimes more (nearby fixes, extra test files) |
| Verification | Verifies its own work unprompted; over-verifies when told to | — |
| Delegation | Spawns subagents more readily than prior models | Lead can keep working while subagents run |
| Chat formatting | — | Uses bold/lists *less*; old anti-formatting rules now overcorrect |

An instruction written to fix one column is a no-op or an active harm in the other. Where the
correction is model-specific, this document says so.

## Effort and thinking

- **Effort is the user's dial, and the default is `high`** on both models. Skills must not
  demand a level; no agent pins one (see Model policy below).
- **Effort level names do not transfer across models.** Anthropic's instruction is to re-run
  an effort sweep on your own evals per model rather than carrying settings over. For the
  studio that means `/eval-agents` numbers are model-scoped: a roster tuned on one model is
  unmeasured on the next, not validated.
- **On Opus 5, effort does not control visible response length** — it controls thinking
  volume. Lowering effort to get a shorter answer does not reliably work; prompt for length
  instead (below). Opus 5 guidance also says to use `low` and `medium` liberally as the
  primary cost/latency control wherever evals show quality holds, and to step up to `xhigh`
  for demanding agentic work.
- **On Fable 5.1**, `medium` roughly matches Fable 5 at lower cost, and at `xhigh`/`max` the
  model can think for long stretches before writing a long deliverable — `high` is the right
  starting point for report-shaped work.
- **Thinking is adaptive, not a budget.** Never write "think hard/harder", "ultrathink", or
  similar triggers into an agent or skill: they do nothing on this generation and are noise on
  earlier models. On Opus 5 thinking *can* be disabled, but only at effort `high` or below,
  and Anthropic recommends against it — with thinking off, the model occasionally emits a tool
  call as plain text (it never runs) or leaks internal XML tags. The studio never disables it.

## Instructions to keep out of agents and skills

Each of these was written for a weaker model and now costs recall, tokens, or both. The
burden of proof sits on *keeping* an instruction — Anthropic removed over 80% of Claude Code's
own system prompt for this generation "with no measurable loss on our coding evaluations".

1. **Verification scaffolding.** "Include a final verification step for any non-trivial task",
   "use a subagent to verify", "double-check your answer", "re-verify before responding".
   Opus 5 verifies and self-corrects unprompted; these instructions compound with that and
   produce over-verification — wasted tokens, no quality gain. This bans *self*-verification
   prompting. It does **not** touch the studio's gates: an independent reviewer re-reading
   someone else's diff is separation of duties, not a re-check (`delegation.md`
   §"When a handoff earns its cost").
2. **Review conservatism.** "Only report high-severity issues", "be conservative", "flag only
   what affects correctness". Opus 5 follows these literally and reports less; its review
   precision is high enough that its extra findings are mostly real. The studio's rule is
   **report everything, filter at the verdict** (`working-preferences.md`
   §"Adversarial review, not echo chamber"; `/review`).
3. **Reasoning echo.** "Show your thinking", "transcribe your reasoning", "explain your chain
   of thought in the output" — these trip the `reasoning_extraction` classifier and the turn is
   refused. Ask for conclusions, findings, verdicts, and evidence. *(Audited 2026-09: no
   shipped agent or skill contains one. Keep it that way.)*
4. **Narration suppression.** "Hold all findings for the final response" and similar were
   written against models that over-narrated. On Fable 5.1 they compound with a model that
   already goes quiet. Delete them before adding any narration instruction.
5. **Anti-formatting rules.** "Never use bullets/bold/headers" was a correction for earlier
   models. Fable 5.1 leans the other way. Say when formatting *is* appropriate instead.
6. **Enumerated recipes.** Skills written for prior models are often too prescriptive for this
   generation and degrade output. Keep "How you work" at intent level — goal, boundaries,
   quality bar. If default behavior already clears the bar, delete the instruction rather than
   refine it.
7. **Mannered prose, in the studio's own documents.** Fable 5.1's guidance names the exact
   pattern: "a dial worth turning" for "a parameter worth varying", "this point earns its
   keep" for "this point still matters". These docs are prompts — an agent reads them and
   matches register. Prefer the literal phrase when one exists.

## Behaviors worth steering explicitly

These are not defaults to delete; they are outcomes the model will not guess.

- **Written deliverable length.** Files this generation writes to disk — reports, specs, ADRs,
  review digests — run longer than on prior models. `/spec`, `/adr`, `/review`, and
  `/session-wrap` all produce documents: say to cover the substance without padding with
  filler sections, redundant summaries, or boilerplate.
- **Narration cadence.** Describe the shape you want rather than "more" or "less": one line
  before the first tool call, a brief update only on a finding or a change of direction, and a
  close that leads with the outcome. That description works on both models; "be terse" is
  wrong on Fable 5.1 and "narrate progress" is wasted on Opus 5.
- **Surgical edits over whole-file rewrites** (Fable 5.1). Unless the file is short or most of
  it is changing, a rewrite costs output tokens and time for the same result. This belongs in
  `rust-builder`, not in every skill.
- **Scope and test restraint.** Both models add unrequested work — Opus 5 by expanding the
  task, Fable 5.1 by fixing nearby code and committing extra test files. Anthropic reports
  that an explicit instruction drops unrequested additions substantially with no measurable
  change in task success. The studio already says this (`working-preferences.md`,
  `maintainer-grade-development.md`); the point is that it is load-bearing, not sediment.
- **Subagent spawn discipline.** Opus 5 delegates more readily than prior models. The
  economics are in `delegation.md`; the deterministic caps are Claude Code's
  `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`
  environment variables (Claude Code 2.1.217+) and the Agent SDK's `max_budget_usd`.
- **Search triggering at low effort** (Fable 5.1). At `low`, the model calls search and
  retrieval tools less and answers from memory more. This is exactly the failure ADR 0001
  recorded: a name from a fast-moving area was reconstructed from memory instead of looked up.
  `/research` and `/deps-check` carry the rule — verify the name as the user wrote it;
  familiarity is not a reason to skip the search. Raising effort for those turns also works.

## Safety classifiers

Fable 5.1's classifiers produce **fewer false positives** than Fable 5's did at launch, and
**finding vulnerabilities in source code is permitted**. False positives still happen. What
happens on a trip depends on the surface:

- **Interactive Claude Code**: the flagged request is automatically re-run on the fallback
  model with a notice, and the session continues there — `/model` to return (it re-flags while
  the trigger is still in context). `/config` has a "switch models when a message is flagged"
  toggle to ask instead.
- **Headless (`claude -p`) / API / SDK**: the flagged request ends the turn with
  `stop_reason: "refusal"`, no automatic fallback.
- **The first request carries workspace context** (CLAUDE.md, git status), so a repo full of
  security material can trigger fallback before you type anything. Diagnose with
  `claude --safe-mode` (disables CLAUDE.md/skills/MCP/hooks).

Three phrasings raise the false-positive rate, and two of them are ours to control:

- **Compile-check phrasing.** "Does this program compile without errors?" trips more often
  than "Are there any bugs in this program?". `/fix-build` and `/verify-loop` ask the second
  question — they read a compiler diagnostic and name the defect.
- **Base64 in tool output.** A tool that returns base64-encoded data into context raises the
  rate; the fix is to stop returning it.
- **Lesser-known languages.** Not a Rust concern, but it is why a `build.rs` that shells out
  to an unusual toolchain is worth describing rather than pasting raw.

## How the studio responds

### Model policy (agent frontmatter)

- **Judgment-heavy agents inherit the session model**: `chief-architect`, `product-steward`,
  `harsh-critic`, `rust-reviewer`, `unsafe-auditor` use `model: inherit`. A gate must never
  judge below the model that wrote the code. (If you drive the studio from a small session
  model and want stronger gates than your session, re-pin these in a fork.)
- **`security-auditor` stays pinned to `opus`.** Its job is hunting vulnerability patterns,
  injection vectors, and exploitability. Since Claude Code 2.1.251 the `opus` alias resolves to
  **Opus 5**, which also runs with classifiers; the difference from an inheriting agent is the
  fallback path. A trip in an interactive session falls back automatically (the default
  `switchModelsOnFlag`), so the audit completes on a model that still clears the bar instead of
  being refused; in headless (`claude -p`) runs a trip still ends the turn with a refusal.
  Pinning the session model onto the gate would instead switch the model for the whole session.
  If you run the RELEASE-GATE headless, pin the agent to a classifier-free model ID for your
  provider in a fork and score its evals there — a refusal that silently weakens the gate is
  worse than a slightly older reviewer.
- **Specialists stay `sonnet`, the scout `haiku`** — routine, well-scoped work; the cost
  tiering is intentional and unchanged.
- **No agent pins `effort`, and that is the decision.** Subagent frontmatter accepts `effort`
  (`low`…`max`) alongside `model`; omitting it means the subagent inherits the session's
  effort. That inheritance is what makes "effort is the user's dial" true for the whole roster
  and not just for skills. `effort` is model-gated (Haiku 4.5 does not take it) and `xhigh`
  needs an xhigh-capable model and can be restricted by org policy, so pinning a level on the
  `model: inherit` gates would break model-agnosticism on a smaller session. Anyone who wants
  to exercise this lever should treat it as an evidence-first change: one agent, measured with
  `/eval-agents` and `bun tools/context-cost.ts`, not a roster-wide sweep — and re-measured per
  model, because the level names don't carry across.

### Authoring rules (agents and skills)

- **Delete what the model no longer needs, and measure the deletion.** The studio's two meters
  are `bun tools/context-cost.ts` (what the hooks inject) and `/eval-agents` (whether recall
  survives the cut). An instruction that changes neither number is sediment. Editorial detail:
  `writing-skills.md`; the delete list is above.
- **Prefer goals and boundaries over enumerated steps**, and validate reviewer-agent edits
  with `/eval-agents` before shipping.
- **No effort or thinking-phrase demands** in skills. Effort is the user's dial.

### Eval-fixture caveat (`/eval-agents`)

The security benchmark fixtures plant real vulnerability patterns — exactly the workspace
content the classifier reads (it sees CLAUDE.md and git status on the first request, and
subagent prompts are screened too). Fable 5.1's lower false-positive rate makes this rarer than
it was, and vulnerability-finding in source is explicitly permitted, but two consequences
remain:

- A `security-auditor` eval can hit the classifier instead of returning findings — that is the
  classifier working, **not** an agent-prompt gap. The agent is pinned to `opus` so an
  interactive trip falls back and the eval still scores; a headless eval run should pin a
  classifier-free model ID (see Model policy above).
- Opening a session *inside* the fixtures directory can trigger model fallback before any
  prompt is sent. Working from the repo root (fixtures are a subdirectory the first-request
  context doesn't inline) avoids this; `claude --safe-mode` confirms whether local
  customizations are the trigger.

### Maintenance: audit the instruction layer against the current model

**Instructions written for a weaker model keep the new model behaving like the weaker model** —
guardrails for failure modes it no longer has, recipes it no longer needs, hardcoded facts that
drifted. Re-run this against the newest model after every model release, and after any release
that changes the roster:

```
Read the studio's agents, skills, and rules end to end.
1. Where do they contradict each other? Quote both sides.
2. Which instructions exist to manage a weaker model — guardrails for failure modes the
   current model doesn't have, spelled-out recipes it no longer needs, drifted constants?
   List with file:line.
3. Which documents violate the patterns they prescribe?
4. What would you delete, and what must stay exactly as is? Report first; don't edit.
```

Validate any reviewer-agent change with `/eval-agents` before shipping it.

### What deliberately did NOT change

The studio's standards docs already encode the behaviors Anthropic recommends prompting for —
they predate this generation and apply to every model:

- act-when-ready / don't over-plan, and "finish the turn — don't end on intent"
  (`working-preferences.md`)
- scope discipline: no unrequested refactors, features, or defensive bloat
  (`maintainer-grade-development.md`, `working-preferences.md`)
- evidence-grounded progress claims — audit every claim against a real command output
  (`integrity-and-evidence.md`)
- checkpoint only on strategic forks, irreversible, or outward actions
  (`coordination-protocol.md`)
- outcome-first, readable summaries (`working-preferences.md`, `agent-template.md`)
