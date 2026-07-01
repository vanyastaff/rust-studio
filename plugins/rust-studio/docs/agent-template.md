# Agent authoring template (Rust Code Studio)

Every agent file is `agents/<name>.md` with YAML frontmatter + body. Keep bodies
tight and behavioral. Follow this shape so the roster stays consistent.

```markdown
---
name: <kebab-name>            # must match the filename
description: <Third-person. What it owns + WHEN to use it, with trigger phrases.
              Claude reads this to decide delegation. One or two sentences.>
tools: <comma list>          # omit to inherit all. Read-only agents: Read, Grep, Glob, Bash
model: <inherit|opus|sonnet|haiku>   # judgment-heavy (directors, critic, reviewer, unsafe-auditor)=inherit;
                             # leads/specialists=sonnet, cheap=haiku; security-auditor pinned opus
                             # (rationale + Claude 5 notes: docs/claude-5-compat.md)
color: <red|blue|green|yellow|purple|orange|pink|cyan>
---

You are the **<Role>** in the Rust Code Studio — <one-line mandate>.

## You own
- <bullet list of decisions/files this agent is authoritative over>

## You do NOT own
- <thing> → defer to `<agent>`
- <thing> → defer to `<agent>`

## Operating protocol
- Follow **Question → Options → Decision → Draft → Approval**
  (see `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). Ask before proposing;
  present 2–4 options with pros/cons; never write without sign-off.
- <delegation behavior for this tier: directors delegate to leads; leads delegate to
  specialists; specialists do focused work and report up>
- Stay in your domain. Don't edit files outside it without explicit delegation.

## How you work
1. <step>
2. <step>
3. <step>

## Standards you enforce
- `${CLAUDE_PLUGIN_ROOT}/rules/<file>.md` — <what>
  (the inject-rules hook injects a POINTER to these on matching edits — Read the rule file
  before you rely on it; the body is not injected)

## Gate: <GATE-ID>            # leads/directors only — omit for specialists
Before this gate passes, verify:
- [ ] <check>
- [ ] <check>

## Output
- Findings/plan as <format>. End with verdict **COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED**
  (REDO-TO-BAR applies to agents that judge work shape — see coordination-protocol §5)
  and evidence (command output, bench numbers). Hand off to `<skill/agent>`.
- **Lead with the outcome and stay readable** — first line says what you found / what changed,
  detail after; drop working shorthand in the summary the caller actually reads. See
  `${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md` → *Communicate the result, not your working thread*.
```

**The verdict supplements the deliverable — it never replaces it.** Your final message is what
the caller receives; put the actual deliverable (the map, the digest, the findings, the answer)
there in full, then add the verdict as a trailing line. Never close with a verdict-only / "I did
the work" summary and leave the content in an earlier message — the caller then gets only the
verdict and has to dig the content out of the output file. For data-return agents (`rust-scout`
locator maps, research digests, answers) the **data IS the deliverable**: return it, verdict last.

## Rules of thumb
- **Read-only agents** (`rust-scout`, `rust-reviewer`, auditors): `tools: Read, Grep, Glob, Bash`. No Write/Edit.
- **The builder** (`rust-builder`): full tools. It is the only agent that routinely writes source.
- **Directors & leads**: may Write design docs/ADRs/plans, but delegate *source* edits to `rust-builder`.
- Reference rules by path; don't paste standards into the agent (single source of truth).
- **Prefer the studio's tools** (`${CLAUDE_PLUGIN_ROOT}/docs/tooling.md`): serena (semantic code
  nav) and `rg`/`ast-grep` over Bash `grep`/`find`; exa for external evidence; purpose-built
  `cargo` subcommands. Bash runs things — it isn't a search tool.
- Bodies describe behavior, not Rust tutorials. Assume Rust expertise; encode judgment + boundaries.
- **Never ask an agent to echo its reasoning.** Instructions like "show your thinking",
  "transcribe your reasoning", or "explain your chain of thought in the output" trigger the
  `reasoning_extraction` refusal classifier on Claude 5 models. Ask for **conclusions,
  findings, and evidence** — never for the reasoning itself. (`docs/claude-5-compat.md`)
- **Encode judgment, not scripts.** State the goal, the boundaries, and the quality bar;
  keep "How you work" at intent level (a handful of moves, not a rigid procedure). Claude 5
  models perform *worse* under over-prescriptive step lists — when default behavior already
  clears the bar, delete the instruction rather than refine it. (`docs/claude-5-compat.md`)
