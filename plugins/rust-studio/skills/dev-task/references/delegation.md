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

### When a handoff earns its cost

§8 decides whether a spawn is *possible*. This decides whether it is *worth it*. A handoff is
not free: the worker starts blind, so the brief has to restate context the orchestrator already
holds; nuance that lived in the conversation does not cross; the same files get re-read on the
other side; and the round trip costs several times the tokens of doing the step inline, plus
wall-clock. Spawning is a tool with a price, not a sign of rigor.

**Two things a separate process buys that an inline phase cannot. A spawn needs one of them:**

1. **Filtering** — the worker reads far more than it returns. `rust-scout` opens thirty files
   and hands back a `file:line` table; `/research` reads a crate's impl and returns a cited
   paragraph; a `--full` review lens reads the whole diff through one lens and returns findings.
   The value is the tokens that *never come back*. If the worker would return most of what it
   read, the filter is not there and you have paid the tax for nothing.
2. **Independence** — the verdict must not come from the author. `rust-reviewer`,
   `harsh-critic`, `unsafe-auditor`, and `security-auditor` are worth a full re-read precisely
   *because* they do not inherit the reasoning that produced the code: an author reviewing their
   own diff re-derives why it was right. This is separation of duties, and it is
   non-negotiable at a gate — the agent that wrote the change never signs off on it
   (`verdicts.md` §4). Here the cost is the point, not the overhead.

**Where inline wins — run the phase yourself, under that agent's brief:**

- The orchestrator already holds the plan *and* the file contents, and the change is a few
  edits in one or two files. The brief would be longer than the diff.
- The work is iterative — draft, compile, adjust. Each round pays the handoff tax again, and
  the compile errors that guide the next edit are already in *your* context.
- The step is a lookup you can answer from what you have read this session.
- Fan-out where every lens would re-derive the same context and return most of it. Parallel
  lenses earn their keep when they are independent and read-only, not when they are the same
  read performed five times.

**Never a reason to delegate:** to avoid doing work you are capable of; to make a thin change
look thorough; to get a second opinion you intend to overrule; or to put a name on a verdict
you already decided. A spawn that exists to launder a conclusion is the **Skipped discipline**
cheat wearing a process costume (`references/integrity-and-evidence.md`).

Skipping the *spawn* is a judgment call. Skipping the *phase* is not — scout before you plan,
plan before you write, read the diff back adversarially before you call it done, whatever the
process count (`references/sub-agents.md`).

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
- **availability is not permission** — a host may ship a worker API alongside a standing
  instruction not to use it. Codex's default mode carries "Do not spawn sub-agents unless the
  user or applicable AGENTS.md/skill instructions explicitly ask for sub-agents, delegation, or
  parallel agent work" (its proactive mode lifts exactly that prior). So a skill must *name* the
  spawn — "spawn `rust-reviewer`", "run these lenses in parallel" — because intent-only phrasing
  does not clear the gate. Where a spawn is declined, fall back to the inline path above; gates
  and verdicts are unchanged.

Do not call a tool merely because an example host exposes it. Never fail the workflow because a
team feature flag, task UI, mailbox, or background mode is missing.

**Roles.** The current session is the orchestrator. A worker receives the complete brief: scope,
relevant files or diff, acceptance criteria, constraints, expected evidence, and required verdict.
Hand a worker its large inputs — a diff, a spec, a fixture — as a **file path**, not pasted
text: the brief stays small, the worker can re-read, and two workers see the same bytes.
Workers do focused work; the orchestrator owns synthesis, user-facing gates, and cleanup.

**Task graph.** Represent phases as tasks when the host supports it. Express dependencies in the
native task surface; keep read-only lenses independent so they can run concurrently. Otherwise
keep the same graph as an ordered checklist in working context. Durable files such as
`tasks.md` remain the source of truth regardless of UI support.

**Write-zone exclusivity.** §3's domain boundaries and §6's single-writer protocol already point
at this; the team model needs it stated because parallel waves are where it actually breaks.
Every spawned unit declares its write zone — the files or directories its brief authorizes it to
touch — in the same brief that carries scope and acceptance criteria. Two units in the same wave
never declare the same write zone. When two tickets genuinely need the same file, they serialize:
the later one is spawned only after the earlier one's result has landed, not launched alongside
it on the promise that it will "wait its turn." This is not hypothetical — an orchestrator
building this plugin fanned out three tickets that all touched `scripts/validate-distribution.sh`
and caught the collision only because it happened to notice; nothing in the doctrine forced the
check.

Read-only work is exempt, and that exemption is the whole asymmetry the model rests on: a lens
that only reads never contends for a write zone, which is why review fan-out (`rust-reviewer`,
`harsh-critic`, `unsafe-auditor`, `security-auditor`) parallelizes freely while a wave of
`rust-builder` tasks touching the same file does not. The studio makes that asymmetry structural,
not a habit an orchestrator has to enforce under load: `rust-scout`, `rust-reviewer`,
`harsh-critic`, `unsafe-auditor`, and `security-auditor` all carry `disallowedTools: Write, Edit,
NotebookEdit` in their own definitions, so they are parallel-safe *by construction* — minimum
tool grant, not orchestrator care, is what actually prevents the conflict. Grant a role only the
tools its job requires; the serialization rule above only has teeth where a role is capable of
writing at all.

Three 2026 sources converge on this independently. Google's Gemini CLI subagents announcement
(developers.googleblog.com, Apr 2026) states it outright: "Exercise caution with parallel
subagents for tasks requiring heavy code edits. Multiple agents editing code simultaneously can
lead to conflicts and overwriting" — its own worked example grants `frontend-specialist` read
tools only, which is what makes it parallel-safe by construction rather than by care. DeepSeek
Harness commentary argues the context half of the same point: dumping a whole repository into a
worker's prompt is not context engineering, it buries the evidence the next call needs — a
declared write zone is exactly the evidence a full-repo dump buries. OpenAI's Codex guidance
reaches the same discipline from the prompting side: state the outcome, not the method, and reuse
durable `AGENTS.md` context across tasks instead of re-deriving scope per spawn — a declared write
zone is that outcome-first brief applied to the one property that makes two spawns unsafe together.

**Results and cleanup.** Collect results through the host's worker-result or messaging channel.
Wait only on workers whose output blocks the next phase. When the host supports explicit worker
shutdown, close workers after their result is integrated; otherwise let the host manage their
lifecycle.

**Host adapters.** Claude Code may expose background subagents (spawned directly through its
agent tool — since 2.1.232 a spawned sub-agent runs in the background by default and the
orchestrator is notified when it finishes; a `fork` of the session inherits the whole
conversation and suits a continuation, never an independent gate lens), task-list tools, and
a mailbox; Codex may expose collaboration workers, custom agents, and a plan surface. Treat
those as adapters for the neutral model above, not prerequisites and not instructions to call
unavailable tools.

**Gotchas (load-bearing).**
- **No plan inheritance** — teammates do *not* inherit the lead's conversation or plan; *all*
  task context must go in the spawn prompt.
- **No bundled MCP** — teammates do *not* receive a subagent definition's bundled
  `skills`/`mcpServers`; they load skills and MCP from the user's own project + user settings.
  The studio's serena/exa reliance works only because the **user** has them configured ambient
  — state that assumption when scouting depends on them.
- **Status can lag** — update the host task surface after integrating a result; don't infer
  completion from silence.
- **Nesting depth is host-specific, and it moves** — check before a worker spawns workers.
  Claude Code went depth 1 → 3 by default in 2.1.220 (2.1.217 had turned nesting off entirely),
  so a lead may now spawn its own specialists; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` disables
  it, and a per-session cap of 200 spawns applies (`CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`,
  since 2.1.212). Codex custom agents default to depth 1 unless `[agents] max_depth` is raised,
  so its orchestrator calls every role directly. Write skills against the floor — one level of
  delegation — and treat deeper nesting as an optimization the host may or may not permit.
  Workers inherit only the permissions and context the host documents.

**Verdicts and gates are unchanged.** Every teammate still ends in **COMPLETE / NEEDS WORK /
REDO-TO-BAR / BLOCKED** with evidence (`verdicts.md` §5); the owning lead still runs its gate (`verdicts.md` §4); a
`REDO-TO-BAR` reshapes the touched area before the work is accepted, and a `BLOCKED` task halts
its dependents until the blocker clears.

**Lifecycle hooks are optional.** A host may expose task or worker lifecycle events, but the
portable workflow never depends on them. Host-specific hooks belong in that host's plugin layer.
