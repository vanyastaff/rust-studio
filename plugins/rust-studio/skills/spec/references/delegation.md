# Coordination Protocol — Delegation

Who does the work, who they report to, and how writes happen. Part of the
Coordination Protocol (`coordination-protocol.md`); see also `collaboration.md` (autonomy,
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

When a host exposes sub-agents (§8), this same model runs over its native task and messaging
surfaces instead of sequential inline phases. The tiers, gates, and verdicts are unchanged —
only the coordination surface differs.

### When sub-agents are unavailable

A host without the studio's sub-agents runs each named phase inline, under that agent's
brief. The tiers, gates (`verdicts.md` §4) and verdicts (`verdicts.md` §5) are unchanged.
The full rule is `references/sub-agents.md`.

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

## 8. Team execution (host-capability based)

The multi-agent skills (`team-*`, `dev-task`, `review`, `doc-review`, `eval-agents`,
`spec-tasks`) use parallel workers only when the current host exposes that capability. They do
not require a particular vendor, environment variable, or tool name. If no worker API exists,
run the named roles inline in the same dependency order, following
`references/sub-agents.md`.

**Capability gate.** Inspect the tools available in the current session:
- worker/sub-agent API available → delegate independent work and parallelize read-only lenses;
- task/plan surface available → mirror phases there for progress and dependencies;
- messaging/result channel available → use it to collect worker results;
- a capability absent → keep a concise in-message checklist and execute that part inline.

Do not call a tool merely because an example host exposes it. Never fail the workflow because a
team feature flag, task UI, mailbox, or background mode is missing.

**Roles.** The current session is the orchestrator. A worker receives the complete brief: scope,
relevant files or diff, acceptance criteria, constraints, expected evidence, and required verdict.
Workers do focused work; the orchestrator owns synthesis, user-facing gates, and cleanup.

**Task graph.** Represent phases as tasks when the host supports it. Express dependencies in the
native task surface; keep read-only lenses independent so they can run concurrently. Otherwise
keep the same graph as an ordered checklist in working context. Durable files such as
`tasks.md` remain the source of truth regardless of UI support.

**Results and cleanup.** Collect results through the host's worker-result or messaging channel.
Wait only on workers whose output blocks the next phase. When the host supports explicit worker
shutdown, close workers after their result is integrated; otherwise let the host manage their
lifecycle.

**Host adapters.** Claude Code may expose background subagents (spawned directly through its
agent tool), task-list tools, and a mailbox; Codex may expose collaboration workers, custom
agents, and a plan surface. Treat those as adapters for the neutral model above, not
prerequisites and not instructions to call unavailable tools.

**Gotchas (load-bearing).**
- **No plan inheritance** — teammates do *not* inherit the lead's conversation or plan; *all*
  task context must go in the spawn prompt.
- **No bundled MCP** — teammates do *not* receive a subagent definition's bundled
  `skills`/`mcpServers`; they load skills and MCP from the user's own project + user settings.
  The studio's serena/exa reliance works only because the **user** has them configured ambient
  — state that assumption when scouting depends on them.
- **Status can lag** — update the host task surface after integrating a result; don't infer
  completion from silence.
- **Nesting depth is host-specific** — check before a worker spawns workers (Claude Code
  allows several levels; Codex custom agents default to depth 1, so its orchestrator calls
  every role directly). Workers inherit only the permissions and context the host documents.

**Verdicts and gates are unchanged.** Every teammate still ends in **COMPLETE / NEEDS WORK /
REDO-TO-BAR / BLOCKED** with evidence (`verdicts.md` §5); the owning lead still runs its gate (`verdicts.md` §4); a
`REDO-TO-BAR` reshapes the touched area before the work is accepted, and a `BLOCKED` task halts
its dependents until the blocker clears.

**Lifecycle hooks are optional.** A host may expose task or worker lifecycle events, but the
portable workflow never depends on them. Host-specific hooks belong in that host's plugin layer.
