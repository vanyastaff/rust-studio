# Rust Code Studio — Coordination Protocol

This is the shared contract every agent and skill in the studio follows. It is
the Rust adaptation of a studio model: a tiered team that delegates downward,
consults sideways, and never ships without your sign-off.

---

## 0. First-pass quality is the contract

First-pass quality is the contract; everything downstream — gates, reviews, verdicts — is a
safety net, **not** where quality is created. Before the first source edit on anything that adds
or moves logic, the planning AND the writing agent run the **maintainer-grade pre-code gate**:
crate ownership; a sibling-crate reuse survey (serena) before inventing; verify crate
version/current docs (cratesio/context7/rust-docs) before coding from memory; the
borrow/allocation/lifetime posture; the latest-edition construct when it encodes the contract
better; and the Maintainer Rejection Test. The gate is the universal **DEFAULT**, not opt-in —
every per-domain gate in §4 runs **on top of** it, and a genuinely trivial change records a
one-line note rather than bypassing the bar. The standard is
`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md` — read it first.

We are solo active-dev with no released API, so restructuring is courage, not creep: existing
code is context, not authority — reshape weak/duplicated/non-idiomatic/wrong-crate shapes you
must TOUCH, within the task's blast radius. A workaround/shim/adapter/alias/migrate-later TODO is
a defect, not a deferral. Compiles + clippy-clean + tests-green + correct is the **FLOOR**, not
the finish line. Reviewers do not anchor to already-written code as a contract: the verdict set
includes `REDO-TO-BAR` (§5). Every dispatched agent is framed as a senior Rust maintainer on the
current edition who would reject mediocre code. None of this lowers fmt/clippy/test/miri/evidence
rigor (§7) — it adds a higher bar on top.

---

## 1. Collaborative Protocol (a quality loop, not a permission loop)

The shape is **Question → Options → Decision → Draft → Approval** — but run it as a
**quality** loop, not a per-step permission loop. The default is **autonomy: decide and
execute**. See `working-preferences.md` for the full operating mode.

**Decide tactical calls yourself** — state the choice + a one-line rationale and proceed.
API shape, drop semantics, channel sizes, internal layout, feature-flag names, tracing
fields, error-variant shapes, test-framework choices, file naming — anything resolvable by
Rust ecosystem best practice and the established constraints. After ~3–4 strategic questions
land scope/structure, **stop asking and start writing**; inline minor decisions.

**Escalate to the user (`AskUserQuestion`) only when load-bearing:**
- a **direction-changing fork** (new crate vs in-place, naming conventions not implied by the
  code, scope cuts, a genuine design fork a review couldn't resolve);
- an **irreversible** action (data loss, `cargo publish`, out-of-repo / non-git edits);
- an **outward** action (push, open a PR);
- a fundamental conflict that would make the next chunk of work meaningless.

Batch unavoidable decisions into one ask. Present decisions-made + results, not a stream of
questions. Autonomy is about **deciding, not skipping process** — keep the gates (§4), the
SDD/TDD discipline, and verification (§7).

**Proceed without asking:** read-only investigation; non-mutating cargo commands
(`check`/`clippy`/`test`/`tree`/benches); local commits on a worktree branch; and executing a
plan/scope already agreed. Note that an `AskUserQuestion` answer does **not** by itself
authorize a later *destructive/irreversible* step — those still need a direct point-of-action
confirmation and must not be bypassed with bash/filesystem tools (§6).

---

## 2. The team (3 tiers)

**Tier 1 — Directors** (model: opus). Own cross-cutting decisions and final gates.
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

**Tier 3 — Specialists** (model: sonnet/haiku, high-stakes ones opus). Do focused work.
- API: `api-designer`, `error-architect`, `macro-specialist`, `docs-engineer`
- Async/web: `async-runtime-specialist`, `web-framework-specialist`, `database-specialist`, `observability-engineer`, `wasm-specialist`
- Systems/perf: `concurrency-specialist`, `unsafe-auditor` (opus), `ffi-specialist`, `perf-engineer`, `embedded-specialist`
- CLI: `cli-specialist`
- Quality: `test-engineer`, `security-auditor` (opus), `dependency-manager`, `build-engineer`

**Execution trio** (the hands — they actually touch code).
- `rust-scout` (haiku) — read-only locator; returns a `file:line` map.
- `rust-builder` (sonnet) — implements within an approved plan; writes code + tests.
- `rust-reviewer` (sonnet) — diff auditor and final gate.

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

---

## 4. Quality gates

Gates are checkpoints a lead (or director) must clear before work proceeds. Each
gate has an ID so it can be referenced in stories and reviews.

| Gate ID         | Owner               | Checks |
|-----------------|---------------------|--------|
| `ARCH-GATE`     | chief-architect     | Module/crate boundaries sound; ADR exists for non-trivial design; no layering violations. |
| `API-GATE`      | api-design-lead     | Public items documented; semver impact understood; `#[non_exhaustive]`/sealed where needed; no accidental pub. |
| `ASYNC-GATE`    | async-systems-lead  | No blocking in async; cancellation-safe; `Send`/`'static` bounds correct; backpressure considered. |
| `CLI-GATE`      | cli-ux-lead         | Exit codes correct; stdout=data / stderr=diagnostics; `--help` complete; errors actionable. |
| `PERF-GATE`     | systems-perf-lead   | Hot paths allocation-aware; benchmarked before/after; no needless clones; complexity justified. |
| `SAFETY-GATE`   | systems-perf-lead + unsafe-auditor | Every `unsafe` has a `// SAFETY:` invariant; miri-clean where feasible; no UB. |
| `QA-GATE`       | qa-lead             | Tests cover acceptance criteria + edge cases; no flaky tests; coverage not regressed. |
| `RELEASE-GATE`  | release-lead        | Version bumped per semver; changelog updated; MSRV verified; `cargo publish --dry-run` clean. |
| `BUILD-GATE`    | tooling-lead        | Builds on all feature combinations + targets; CI green; no warnings. |

### Review modes

Pick intensity to match the work (set in your project notes or per-invocation):

- **full** — all relevant gates run by their owning leads. Default for public APIs,
  `unsafe`, releases, and anything touching many crates.
- **lean** — only the directly-relevant gate(s) run; one reviewer pass. Default for
  routine features inside one crate.
- **solo** — gates are advisory; `rust-reviewer` does a single pass. For prototypes
  and throwaway spikes.

---

## 5. Verdicts

Multi-agent skills (the `team-*` family, `dev-task`, `review`) end with an explicit
verdict so you always know where things stand:

- **COMPLETE** — work done, gates passed, evidence shown (test output, bench numbers).
- **NEEDS WORK** — specific, listed issues block completion; each has an owner.
- **REDO-TO-BAR** — the change compiles + clippy-clean + tests-green + correct, but a strict
  maintainer would reject its SHAPE: wrong crate, a reinvented sibling primitive, a
  clone-to-appease-borrowck, a stringly/bool API where a domain type belongs, a stale idiom, or
  an active-dev shim. The fix is to **reshape the TOUCHED area**, not apply line patches. It is
  merge-blocking but **blast-radius-bounded** — only code the task touched is reshaped; untouched
  code is never force-reshaped, and this verdict is **not** for speculative abstraction or
  future-proofing.
- **BLOCKED** — a hard dependency is missing (e.g. an ADR, an upstream decision);
  the blocker is named with a suggested next step. Completed work is never discarded for NEEDS
  WORK; `REDO-TO-BAR` explicitly authorizes replacing the wrong shape within the task's blast
  radius — the learning is kept, the junior patch is not.

---

## 6. File-write protocol

- Orchestrator skills (`team-*`, `dev-task`) **delegate all writes to sub-agents**;
  they do not call Write/Edit directly. This holds whether the orchestrator is a
  single-session lead or a team lead running over the shared task list (§8) — `rust-builder`
  still owns every write.
- Before writing, show a draft or a diff and get approval (per §1).
- `rust-builder` writes code and tests; `rust-scout` and `rust-reviewer` never write.
- Never bypass these for "speed" — the protocol is the product.

---

## 7. Evidence over assertion

Claims about correctness or performance must be backed by command output:
- "tests pass" → paste the `cargo test` / `cargo nextest` summary.
- "faster" → paste criterion's before/after.
- "clippy-clean" → `cargo clippy --all-targets --all-features -D warnings` exit 0.
- "no UB" → `cargo +nightly miri test` output (where feasible).

If something was skipped, say so. Never substitute "probably" for checking.

---

## 8. Team execution (agent teams)

The multi-agent skills (`team-*`, `dev-task`, `review`, `doc-review`, `eval-agents`,
`spec-tasks`) run their phases as a real **agent team** when that capability is available,
and fall back to single-orchestrator prose delegation otherwise. The team model is the
documented default path; the fallback is one short paragraph in each skill.

**Capability gate.** Agent teams are gated by `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (OFF
by default; needs Claude Code v2.1.32+). A published plugin must not assume teams exist, so
every orchestrator skill carries a one-line guard: if the gate is set, run as a team;
otherwise spawn sub-agents sequentially and inline each phase's context into the spawn
prompt. The structured task tools (`TaskCreate` / `TaskUpdate` / `TaskList` / `TaskGet`) are
a separate, more reliable gate (`CLAUDE_CODE_ENABLE_TASKS`, default ON as of v2.1.142) — but
still version-gate them.

**Roles.** One session is the **team lead** (the orchestrator skill). The lead calls
`TeamCreate` (creates the team and its single shared task list), spawns **teammates** via the
`Agent` tool with `team_name` + `name` (+ `subagent_type` = a studio agent such as
`rust-builder`), assigns work, synthesizes results, and drives cleanup. Teammates do the
focused work and report back.

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

**Cleanup.** The lead drives teardown with `TeamDelete`, which fails while members are still
active — so shut teammates down first by sending each a `SendMessage` `{type:"shutdown_request"}`,
then delete the team.

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
REDO-TO-BAR / BLOCKED** with evidence (§5); the owning lead still runs its gate (§4); a
`REDO-TO-BAR` reshapes the touched area before the work is accepted, and a `BLOCKED` task halts
its dependents until the blocker clears.

**Lifecycle hooks (cross-reference, not added here).** The `TaskCreated` / `TaskCompleted` /
`TeammateIdle` lifecycle hooks exist (a hook may exit 2 to block with feedback), so gate
enforcement can hang off them in principle. Those hooks are owned by the hooks work — this
protocol only notes the seam; none are wired in this pass.
