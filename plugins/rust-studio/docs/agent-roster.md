# Rust Studio roles and profiles

Choose a role for the action and the independence boundary, then load every applicable
profile from the catalog. Roles are not domain owners or a management hierarchy. A profile
supplies expertise and checks; it grants no write permission and does not select a model.

| Role | Default action | Model class | Boundary |
|---|---|---|---|
| `researcher` | Locate facts and source evidence | haiku | Read-only; return a cited map or answer |
| `designer` | Compare contracts and propose designs | inherit | Read-only; coordinator records the design |
| `implementer` | Write authorized source, tests, configuration or artifacts | sonnet | Declared write paths and acceptance; cannot sign off its own work |
| `reviewer` | Challenge design/code against applicable standards | inherit | Read-only, separate from the author |
| `verifier` | Execute checks and compare outcomes with requirements | inherit | Read-only project sources; execution may create ordinary build output |

The current session coordinates scope, artifact recording, integration and combined verdicts.
It does not need a clerical worker to write a spec or verification report. A named role alone
cannot establish independence: use a separate fresh worker without inherited author context
where the review, handoff or acceptance protocol requires it. Missing isolation remains
unverified under `references/elephant-workflow.md` and `references/sub-agents.md`.

## Required profile selection

Load the relevant canonical profiles before acting on their domain. Combine them when the
work crosses domains. For example, async implementation uses an implementer with async,
implementation and any affected API/web/data profiles; an independent async review uses a
reviewer with async and correctness profiles. Missing required profile content blocks that
lens rather than silently reducing it to a generic review.

| Profile | Expertise |
|---|---|
| `references/profiles/navigation.md` | Symbol, caller, test and configuration mapping |
| `references/profiles/architecture.md` | Boundaries, dependencies, scope, ownership and migration |
| `references/profiles/api.md` | Types, traits, errors, public contracts and SemVer |
| `references/profiles/async.md` | Cancellation, runtime topology, spawning and backpressure |
| `references/profiles/systems.md` | Unsafe, concurrency, memory model and soundness |
| `references/profiles/platforms.md` | FFI, embedded/no_std and WASM constraints |
| `references/profiles/web.md` | Routing, middleware, extraction and HTTP behavior |
| `references/profiles/data.md` | Persistence, migrations, transactions and pools |
| `references/profiles/cli.md` | CLI/TUI behavior, signals, streams and exit codes |
| `references/profiles/macros.md` | Macro expansion, hygiene, diagnostics and compile tests |
| `references/profiles/observability.md` | Tracing, metrics, cardinality and data exposure |
| `references/profiles/performance.md` | Profiling, allocations, benchmarks and binary size |
| `references/profiles/implementation.md` | Scoped source changes, meaningful tests and project gates |
| `references/profiles/testing.md` | Scenario coverage, properties, fixtures and test evidence |
| `references/profiles/tooling.md` | Build scripts, features, targets and CI |
| `references/profiles/dependencies.md` | Versions, licenses, sources, MSRV and supply-chain surface |
| `references/profiles/security.md` | Trust boundaries, auth, input validation and vulnerability triage |
| `references/profiles/documentation.md` | Rustdoc, examples, doctests and published docs |
| `references/profiles/release.md` | Versioning, changelog, MSRV and publish readiness |
| `references/profiles/correctness.md` | Defect, scope, regression and evidence review |
| `references/profiles/adversarial.md` | Premise, alternatives, omissions and failure scenarios |
| `references/profiles/structure.md` | Duplicates, dead surface, orphan files and boundary debt |

Named ARCH/API/ASYNC/CLI/PERF/SAFETY/QA/RELEASE/BUILD/SCOPE gates remain in
`references/verdicts.md`. A separate reviewer/verifier applies their relevant profiles; writing
documentation does not let its author sign off API or release documentation checks.

## Special effects and compatibility

A prototype request dispatches an implementer with explicit disposable paths and experiment
criteria; the designer stays read-only and receives findings afterward. Requested test or
fuzz-target authoring uses an implementer, followed by a fresh verifier. A coverage or
verification request alone does not authorize production repairs.

Legacy task roles resolve through `catalog.json` to a role and profile. This mapping preserves
old records and repair counts; it does not rewrite historical provenance, establish exclusive
profile ownership, or reinstall old-name agents. Keep source/destination identities and next
actions in the existing task record.

Model classes are host routing hints. Researcher uses haiku, implementer sonnet, and the other
three roles inherit. Profiles never override them. Hosts and user overrides can change the
effective model; report actual routing and retain the user's effort setting. Codex generation
uses optional local model mappings and otherwise omits provider model names
(`references/model-routing.md`).
