# Claude 5 (Fable 5) compatibility notes

How the studio runs on the Claude 5 model family, and the authoring rules that keep it
working there. Grounded in Anthropic's official guidance:

- [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- [Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5)
- [Migration guide (Opus 4.8 → Fable 5)](https://platform.claude.com/docs/en/about-claude/models/migration-guide)
- [Claude Code model configuration — Work with Fable 5 / Automatic model fallback](https://code.claude.com/docs/en/model-config)

The studio stays **model-agnostic** — everything here degrades gracefully on Opus/Sonnet/Haiku
sessions. Nothing in the plugin requires Fable 5.

## What changed with the Claude 5 family

- **Adaptive thinking is always on**; there is no "disable thinking" and no thinking budget.
  Depth is controlled by the session's **effort** setting, not by prompt phrases. Never write
  "think hard/harder", "ultrathink", or similar triggers into an agent or skill — they do
  nothing on Claude 5 and are noise on earlier models.
- **Effort guidance flipped.** On Opus 4.8 the advice for coding/high-autonomy work was
  `xhigh`; on Fable 5 the default is `high` for most tasks, with `xhigh` reserved for the most
  capability-sensitive workloads. Lower effort on Fable 5 still often exceeds `xhigh` on prior
  models. Skills must not demand a specific effort level.
- **Safety classifiers screen requests.** Fable 5 screens for offensive-cyber content,
  bio/life sciences, and **extraction of its own reasoning** (`reasoning_extraction`).
  Benign security work can occasionally trip the cyber classifier. What happens on a trip
  depends on the surface:
  - **Interactive Claude Code**: the flagged request is automatically re-run on the default
    Opus model with a notice, and **the session continues on Opus** — `/model fable` to
    return (it re-flags while the trigger is still in context). `/config` has a
    "switch models when a message is flagged" toggle to ask instead.
  - **Headless (`claude -p`) / API / SDK**: the flagged request ends the turn with a
    **refusal**, no automatic fallback.
  - **The first request carries workspace context** (CLAUDE.md, git status), so a repo full
    of security material can trigger fallback before you type anything. Diagnose with
    `claude --safe-mode` (disables CLAUDE.md/skills/MCP/hooks).
- **Review recall is up.** Anthropic reports bug-finding recall (outside classifier-covered
  domains) noticeably above Opus 4.8, including search across codebases and repo history.
- **Subagent orchestration is more dependable** — Fable 5 dispatches and sustains parallel
  subagents more reliably, which the team skills (`/team-*`, `/dev-task`, `/review`) lean on.

## How the studio responds

### Model policy (agent frontmatter)

- **Judgment-heavy agents inherit the session model**: `chief-architect`, `product-steward`,
  `harsh-critic`, `rust-reviewer`, `unsafe-auditor` use `model: inherit`. A gate must never
  judge below the model that wrote the code; on a Fable 5 session the gates get Fable 5's
  review recall, on an Opus session nothing changes. (If you drive the studio from a small
  session model and want stronger gates than your session, re-pin these to `opus` in a fork.)
- **`security-auditor` stays pinned to `opus`.** Its job is hunting vulnerability patterns,
  injection vectors, and exploitability — exactly the content Fable 5's cyber classifier
  screens. A mid-audit trip means a refusal in headless runs or an unplanned model swap in
  interactive ones, either of which silently weakens the RELEASE-GATE; Opus 4.8 runs the
  same audit deterministically.
- **Specialists stay `sonnet`, the scout `haiku`** — routine, well-scoped work; the cost
  tiering is intentional and unchanged.

### Authoring rules (agents and skills)

- **Never instruct an agent to echo, transcribe, or "show" its reasoning** in output. On
  Claude 5 this trips the `reasoning_extraction` classifier and the turn is refused. Ask for
  conclusions, findings, verdicts, and evidence. (Audited 2026-07: no shipped agent or skill
  contains such an instruction — keep it that way.)
- **Prefer goals and boundaries over enumerated steps.** Anthropic's guidance is explicit:
  skills written for prior models are often **too prescriptive** for Fable 5 and can degrade
  output. When editing an agent/skill, ask whether each instruction still earns its place —
  if default behavior already clears the bar, delete it. Validate reviewer-agent edits with
  `/eval-agents` before shipping.
- **No effort or thinking-phrase demands** in skills. Effort is the user's dial.

### Eval-fixture caveat (`/eval-agents`)

The security benchmark fixtures plant real vulnerability patterns — exactly the workspace
content the classifier reads (it sees CLAUDE.md and git status on the first request, and
subagent prompts are screened too). Two consequences on a Fable 5 session:

- A `security-auditor` eval can hit the classifier instead of returning findings — that is
  the classifier working, **not** an agent-prompt gap. The agent is pinned to `opus`
  precisely so this doesn't happen; if you unpin it, score its evals on an Opus session.
- Opening a session *inside* the fixtures directory can trigger model fallback before any
  prompt is sent. Working from the repo root (fixtures are a subdirectory the first-request
  context doesn't inline) avoids this; `claude --safe-mode` confirms whether local
  customizations are the trigger.

### Maintenance: audit the instruction layer against the current model

Anthropic's guidance (and early field reports) converge on the same point: **instructions
written for a weaker model keep the new model behaving like the weaker model** — guardrails
for failure modes it no longer has, recipes it no longer needs, hardcoded facts that
drifted. Claude Code's own Fable 5 guidance says to describe the outcome rather than the
steps and to skip verification reminders it no longer needs. Periodically run the studio's
prompts through a self-audit on the newest model:

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

The studio's standards docs already encode the behaviors Anthropic recommends prompting for
on Fable 5 — they predate it and apply to every model:

- act-when-ready / don't over-plan, and "finish the turn — don't end on intent"
  (`working-preferences.md`)
- scope discipline: no unrequested refactors, features, or defensive bloat
  (`maintainer-grade-development.md`, `working-preferences.md`)
- evidence-grounded progress claims — audit every claim against a real command output
  (`integrity-and-evidence.md`)
- checkpoint only on strategic forks, irreversible, or outward actions
  (`coordination-protocol.md`)
- outcome-first, readable summaries (`working-preferences.md`, `agent-template.md`)
