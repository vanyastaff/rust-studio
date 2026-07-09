# Coordination Protocol — Delegation

Who does the work, who they report to, and how writes happen. Part of the
[Coordination Protocol](coordination-protocol.md); see also `collaboration.md` (autonomy,
when to ask) and `verdicts.md` (gates, verdicts, evidence).

---
## 2. The team (3 tiers)

**Tier 1 — Directors** (model: inherit — the session model). Own cross-cutting decisions and final gates.
- `chief-architect` — architecture, crate/module boundaries, ADRs, final technical gate.
- `product-steward` — scope, priorities, milestones, story breakdown, change propagation.

**Tier 2 — Leads** (model: sonnet). Own a domain and its quality gate.
- `api-design-lead` — public API surface, crate boundaries, semver.
- `async-systems-lead` — async/web services, runtime topology, service design.
- `cli-ux-lead` — CLI/TUI ergonomics, command structure, terminal UX.
- `systems-perf-lead` — performance, `no_std`, `unsafe`, FFI, memory.
- `qa-lead` — test strategy, coverage, flakiness, CI gates.
- `release-lead` — versioning, crates.io publish, changelog, MSRV.
- `tooling-lead` — build/cargo/CI infrastructure, workspace config, dev tooling.

**Tier 3 — Specialists** (model: sonnet; judgment-heavy ones inherit, `security-auditor` pinned opus). Do focused work.
- API: `api-designer`, `error-architect`, `macro-specialist`, `docs-engineer`
- Async/web: `async-runtime-specialist`, `web-framework-specialist`, `database-specialist`, `observability-engineer`, `wasm-specialist`
- Systems/perf: `concurrency-specialist`, `unsafe-auditor` (inherit), `ffi-specialist`, `perf-engineer`, `embedded-specialist`
- CLI: `cli-specialist`
- Quality: `test-engineer`, `security-auditor` (opus), `dependency-manager`, `build-engineer`
- Cross-cutting: `harsh-critic` (inherit) — adversarial design/spec/plan critic, read-only.

**Execution (4)** (the hands — they actually touch code).
- `rust-scout` (haiku) — read-only locator; returns a `file:line` map.
- `rust-builder` (sonnet) — implements within an approved plan; writes code + tests.
- `rust-build-resolver` (sonnet) — gets a failing build green; fixes the root cargo/rustc error.
- `rust-reviewer` (inherit) — diff auditor and final gate.

See `agent-roster.md` for the full org chart and who-owns-what.

---
## 3. Delegation model

Agents follow a structured delegation model:

1. **Vertical delegation** — directors delegate to leads, leads delegate to
   specialists. Never skip tiers for complex decisions.
2. **Horizontal consultation** — same-tier agents may consult each other but must
   not make binding decisions outside their own domain. This consultation may happen
   **at build time**: the builder may pull a same-tier specialist for a design pass
   *during* writing so domain expertise lands in the first draft, not only as a later
   review lens.
3. **Conflict resolution** — disagreements escalate to the shared parent:
   - Technical/architecture conflicts → `chief-architect`.
   - Scope/priority conflicts → `product-steward`.
   - Quality vs. ship-date conflicts → `product-steward` with `qa-lead` input.
4. **Change propagation** — cross-crate / cross-domain changes are coordinated by
   `product-steward` (e.g. a public API change that ripples into docs, tests, and
   downstream crates).
5. **Domain boundaries** — agents do not modify files outside their domain without
   explicit delegation. A specialist proposes; the owning lead approves.

When agent teams are enabled (§8), this same model runs over a shared task list and a
mailbox instead of sequential prose spawns: the lead encodes phases as tasks with
dependencies and teammates report via `SendMessage`. The tiers, gates, and verdicts are
unchanged — only the coordination surface differs.

### When sub-agents are unavailable

The studio's agents (`rust-scout`, `rust-builder`, `rust-reviewer`, the leads and
specialists) ship as Claude Code sub-agent definitions. An agent host without them —
most hosts that install these skills standalone — cannot spawn a named agent.

**Play the roles yourself, sequentially, in the same session.** A phase named for an
agent becomes a phase you execute under that agent's brief: scout before you plan, plan
before you write, review the diff as an adversarial reader before you call it done. The
tiers, gates (`verdicts.md` §4), and verdicts (`verdicts.md` §5) are unchanged; only the
number of processes is. Do not treat a missing sub-agent as a blocker, and do not skip
the phase it owned.

---
## 6. File-write protocol

- Orchestrator skills (`team-*`, `dev-task`) **delegate all writes to sub-agents**;
  they do not call Write/Edit directly. This holds whether the orchestrator is a
  single-session lead or a team lead running over the shared task list (§8) — `rust-builder`
  still owns every write.
- Before writing, show a draft or a diff and get approval (per `collaboration.md` §1).
- `rust-builder` writes code and tests; `rust-scout` and `rust-reviewer` never write.
- Never bypass these for "speed" — the protocol is the product.
- Where no sub-agent exists to delegate to (§3), the orchestrator writes — but only after
  running the scout and plan phases it would otherwise have delegated.

---
---

## 8. Team execution (agent teams)

The multi-agent skills (`team-*`, `dev-task`, `review`, `doc-review`, `eval-agents`,
`spec-tasks`) run their phases as a real **agent team** when that capability is available,
and fall back to single-orchestrator prose delegation otherwise. The team model is the
documented default path; the fallback is one short paragraph in each skill.

**Capability gate.** Agent teams are gated by `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (OFF
by default). As of Claude Code v2.1.178 the model is **one implicit team per session**: there
is no longer a `TeamCreate`/`TeamDelete` step (those tools were removed) — when the gate is
set, the session already has a single shared team and task list, and you just spawn teammates
into it. A published plugin must not assume teams exist, so every orchestrator skill carries a
one-line guard: if the gate is set, run as a team; otherwise spawn sub-agents sequentially and
inline each phase's context into the spawn prompt. The structured task tools (`TaskCreate` / `TaskUpdate` / `TaskList` / `TaskGet`) are
a separate, more reliable gate (`CLAUDE_CODE_ENABLE_TASKS`, default ON as of v2.1.142) — but
still version-gate them.

**Roles.** One session is the **team lead** (the orchestrator skill). The session's single
implicit team and its shared task list already exist; the lead spawns **teammates** directly
via the `Agent` tool with `name` (+ `subagent_type` = a studio agent such as `rust-builder`),
assigns work, synthesizes results, and drives cleanup. (`team_name` is still accepted but
ignored — don't pass it.) Teammates do the focused work and report back.

**Shared task list.** The lead encodes each skill's **phases / work-items as tasks**:
`TaskCreate` (subject, description, optional `activeForm`/`metadata`; tasks start pending with
no owner) one per phase or lens; express phase ordering with `addBlockedBy` so a task can't be
claimed until its blockers complete; assign with `TaskUpdate owner`; move tasks
pending → in_progress → completed. Use `TaskList` / `TaskGet` to track. For read-only fan-out
panels (`/review --full` lenses, `/doc-review` personas, `/eval-agents` fixtures) create one
independent task per lens/persona/fixture so they run concurrently; the lighter alternative is
to spawn each as a **background subagent** (`background: true`) since they only read.

**Mailbox.** Teammates communicate **only** via `SendMessage` — plain text in a turn is
invisible to other agents. Messages auto-deliver as turns; there is no polling.

**Cleanup.** There is no `TeamDelete` (the team is implicit and lives for the session). Shut
teammates down at the end by sending each a `SendMessage` `{type:"shutdown_request"}`; idle
teammates also auto-hide after ~30s.

**Gotchas (load-bearing).**
- **No plan inheritance** — teammates do *not* inherit the lead's conversation or plan; *all*
  task context must go in the spawn prompt.
- **No bundled MCP** — teammates do *not* receive a subagent definition's bundled
  `skills`/`mcpServers`; they load skills and MCP from the user's own project + user settings.
  The studio's serena/exa reliance works only because the **user** has them configured ambient
  — state that assumption when scouting depends on them.
- **Status can lag** — remind teammates to mark their task `completed`; don't infer completion
  from silence.
- **One team at a time**, no nested teams; teammates inherit the lead's permission mode.

**Verdicts and gates are unchanged.** Every teammate still ends in **COMPLETE / NEEDS WORK /
REDO-TO-BAR / BLOCKED** with evidence (`verdicts.md` §5); the owning lead still runs its gate (`verdicts.md` §4); a
`REDO-TO-BAR` reshapes the touched area before the work is accepted, and a `BLOCKED` task halts
its dependents until the blocker clears.

**Lifecycle hooks (cross-reference, not added here).** The `TaskCreated` / `TaskCompleted` /
`TeammateIdle` lifecycle hooks exist (a hook may exit 2 to block with feedback), so gate
enforcement can hang off them in principle. Those hooks are owned by the hooks work — this
protocol only notes the seam; none are wired in this pass.

