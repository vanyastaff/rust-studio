# Rust Studio usage guide

The installed catalog has 11 outcome skills and five execution roles. Ten skills are portable;
maintain-studio needs the full plugin and its supported host/source environment. The catalog
in `catalog.json` owns operation names, effect boundaries, profiles and migration mappings.

## Choose the outcome and operation

Use `/skill --mode operation <request>`, or describe the outcome so the skill can select its
mode. A mode identifies work; it never grants authorization. The three explicit-only groups
must be invoked by the user and are not called through a discoverable workflow.

| Skill | Operations | Invocation and packaging |
|---|---|---|
| `inspect-project` | onboard, classify, catalog, recall, orient, diagnose-host | Discoverable; Portable |
| `research-topic` | investigate | Discoverable; Portable |
| `design-change` | architecture, api, clarify, domain, prototype, specification, tests, explore | Discoverable; Portable |
| `implement-change` | size, diagnose, implement, compiler, intermittent, conflicts, performance, refactor, pr-feedback, test-first, repair-gate, plan | Discoverable; Portable |
| `review-work` | api, soundness, dependencies, design, memory, prose, diff, scope, security, structure | Discoverable; Portable |
| `verify-work` | ledger, coverage, fuzz, lint, minimum-rust, mutation, acceptance | Discoverable; Portable |
| `write-docs` | decision, changelog, memory, handoff | Discoverable; Portable |
| `configure-tooling` | ci, environment, tests | Discoverable; Portable |
| `maintain-project` | dependency, improve, migrate, scaffold, worktrees | Explicit invocation; Portable |
| `maintain-studio` | evaluate, status-line | Explicit invocation; Full plugin only |
| `publish-change` | commit, pull-request, release | Explicit invocation; Portable |

`/inspect-project --mode catalog` shows the available catalog on the current host. If bare
names collide with another installation, use the host's qualified Rust Studio name or exact
skill path. Disclosed procedures preserve each operation's substantive behavior; installing
one portable skill bundles the standards, procedures, profiles and helpers it requires.

## Effects and authorization

Inspection, diagnosis, review and verification default to read-only work. Research can produce
a requested research artifact; design and writing modes produce requested artifacts. An
implementation request authorizes changes only within its scope. Existing authorization
continues across phases; an explicit design-only, plan-only or diagnosis-only request stops
at its requested result. Ask only for consequential user decisions or missing authorization.
No workflow automatically commits, pushes, opens a PR or publishes at completion.

Verification does not silently repair production code. Explicit ledger authoring is an artifact
operation; explicit tests or fuzz targets are written by an implementer, then checked by a
separate fresh verifier. A prototype likewise uses an implementer with disposable paths and
experiment criteria. The designer remains read-only, and findings return to the same design.
Memory-store writes require user/host authorization, including at session wrap.

## Roles and domain profiles

Researcher locates evidence, designer proposes contracts, implementer writes scoped changes,
reviewer challenges artifacts, and verifier checks delivered behavior. All except implementer
are read-only for project sources. The coordinator records plans/reports directly. Select role
by action, then load every applicable domain profile; profiles do not grant permissions or
select models. See [roles and profiles](agent-roster.md) and [delegation](delegation.md).

For example, an async public API may need async, API and testing expertise across design,
implementation and review. Those are reusable profiles, not three installed personas. A fresh
reviewer with those profiles can challenge the design, while a different implementer uses them
to build it. Named gates retain their domain checks in [verdicts](verdicts.md).

Fresh instances and controlled inputs establish independence. Changing a role label does not.
If the host cannot isolate context, retain useful analysis and report required independence
as unverified. See [host fallback](sub-agents.md). Role model classes are researcher=haiku,
implementer=sonnet, others=inherit; profiles do not override them. Host settings determine
actual models/effort ([model routing](model-routing.md)).

## A substantive change

1. `/inspect-project --mode orient` loads instructions and a concise project context index.
2. `/design-change --mode specification` records current behavior, contracts, ownership,
   failure/recovery, real consumers, migration/removal and observable acceptance. Use explore,
   architecture, api, domain or tests modes for the actual design question on the same spec.
3. `/review-work --mode design --fresh` runs fresh Goldfish comprehension and challenge.
4. `/implement-change --mode plan` writes or reconciles tasks and stops when explicitly asked
   for planning only. Authorized implementation continues in implement mode.
5. A fresh implementer reconstructs artifact inputs before writing, rechecks current bytes,
   then performs test-first implementation and destination integration.
6. `/verify-work --mode acceptance` combines current project gates with fresh original-request
   acceptance and writes the verification report.

The [Elephant protocol](elephant-workflow.md) owns this lifecycle. PREPARED/CURRENT describe
inventoried input bytes, not correctness or permission. Reserve tasks before capture, freeze
inputs during the challenge and check immediately before the first source write. Resume active
tasks with current evidence and retained repair counters. Intended implementation edits make
the input packet stale; acceptance concerns the delivered destination tree.

Small obvious changes retain the implementation fast path. It avoids durable-design ceremony
while keeping checks appropriate to behavior and risk. Escalate if a design fork, public API,
unsafe code, cross-crate ripple or new dependency appears. Preserve completed work.

## Artifacts and acceptance

New designs use `docs/designs/<slug>/`: spec.md, tasks.md, optional acceptance.md and
verify-report.md. Legacy `.rust-studio/specs/<slug>/` stays readable in place. Slug collisions
fail; an explicit path selects the intended artifact. Keep one task record and ledger.

`/verify-work --mode ledger` authors or checks a requested acceptance ledger. CHECK plus EXPECT
must establish an observable outcome; zero matched tests are not evidence. Reverify against
the actual destination, preserving unmet, stale and abandoned criteria in the denominator.
Both default roots use the owning repository cwd. Custom locations require direct checker
execution with --cwd <root>; automatic Stop-guard discovery covers only the two default roots.
[Acceptance format and limits](acceptance-ledger.md) define the exact contract.

## Practical routing

- Unknown runtime failure: `/implement-change --mode diagnose`; diagnosis alone does not repair.
- Compiler error with requested fix: `/implement-change --mode compiler`.
- Performance or binary-size work: performance or size mode, with before/after measurements.
- Existing diff: `/review-work --mode diff`; use api, soundness, dependencies, security or
  structure for the relevant audit, not a write-capable role as reviewer.
- CI/test configuration: `/configure-tooling --mode ci` or tests within requested scope.
- Publication: user invokes `/publish-change --mode commit`, pull-request or release, each
  with its own target and authorization. Release dry-run evidence is not a published release.
- Plugin evaluation/status line: user invokes `/maintain-studio --mode evaluate` or status-line
  in the supported full-plugin environment. Historical benchmark runs do not prove this catalog.

## Host and project evidence

Hooks can supply context and reminders, but a direct helper probe is not proof of native host
loading/trust. Use diagnose-host mode for capabilities and [Codex notes](codex-compat.md) for
adapter details. The [installation guide](../../../INSTALL.md) distinguishes portable skills,
plugin hooks and generated custom agents. Generator upgrades preserve customized or unknown
agent files and report them instead of deleting them.

Use the project's actual feature/target/environment gate ([project-gate](project-gate.md)).
Serialize expensive shared builds; retain source/destination identities, current command
results and next actions across interruption ([task continuity](task-continuity.md)). Review
repairs share a bounded durable counter ([repair protocol](review-repair.md)). Local completion
is separate from remote issue, PR and merge state.