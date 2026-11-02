# Map project context

This procedure shares one inventory between classify, orient and onboard. Classify ends with
the stack profile. Orient adds the next workflow. Onboard adds the API/domain assessment and
any authorized context artifacts. Keep inspection read-only unless the request includes writes.

## Establish the inventory

Locate Cargo.toml with `rg --files` or file navigation, read applicable project instructions,
then resolve workspace members and their manifests. Record package/workspace names, inherited
edition and rust-version, lib/bin/proc-macro targets, features, direct/dev/build dependencies,
patch/replace settings, module declarations, re-exports and feature-gated source. Use symbol
navigation when available and `rg` for cfg or macro-generated sites; missing symbol tools
reduce precision, not permission to investigate (`references/tooling.md`).

Classify all supported domains from manifest and source evidence: libraries, async/web,
CLI/TUI, systems/embedded, storage and WASM. Dependency signals include async runtimes and
web frameworks, CLI/terminal crates, database drivers, embedded-hal, bindgen and cc. Confirm
no_std and unsafe posture in source. List present and absent deny/toolchain/cargo/clippy/rustfmt
configurations, CI, nextest, benchmark harnesses, property tests and fixtures. Optional
`cargo modules structure` and `cargo modules orphans --cfg-test` add compiler-aware evidence.

Load the existing context index, architecture/ADRs and relevant prior decisions using
`references/procedures/context-recall.md`. Infer error handling, tracing, test patterns and
compatibility policy from actual source. Resolve guideline conflicts through
`references/rust-guidelines.md`, naming profile, crate scope and justified exceptions for
applications versus libraries. The inventory is complete when each member and requested
domain has evidence or an explicit coverage gap.

## Assess onboarding gaps

Map exported traits, types, functions and impls, including conditional exports. Assess API
maturity, 0.x policy, hidden/unstable items, downstream construction and SemVer constraints.
Report leaky internals, unclear errors and absent stability decisions with evidence; exhaustive
types are not automatically defects. Select applicable profiles through
`references/agent-roster.md` and inspect:

- Tooling and release: dependency policy, CI lint/test/publish stages, package metadata,
  changelog and release prerequisites.
- Tests: missing integration/doc/property tests and happy-path-only coverage. Label inferred
  gaps separately from coverage measurements.
- Systems: unsafe SAFETY invariants, no_std boundaries and benchmark support for performance
  claims.
- Async: blocking calls, cancellation behavior and owner/join/abort paths for spawned work.
- Structure: duplicate functions/types, orphans, cycles, accidental/dead exports, unused
  dependencies, untyped model calls and naming/pattern/boundary residue. Use the structure
  profile and `references/core.md`; prior audit output is a baseline to verify.

Each finding names evidence, consequence, priority and verification status. Group by tooling,
tests, soundness, API, concurrency, release and structure. Continue independent assessments
when one domain is blocked.

## Record authorized context

Reuse the existing index or `references/templates/project-context.md` at
`docs/project-context.md`. Link instructions, source/tests/configuration, actual gates,
constraints, design history and open evidence. Preserve original request and amendments for
fresh workers. Existing designs stay in place; new designs use `docs/designs/<slug>/` under
`references/elephant-workflow.md`. Resolve ambiguous design slugs to an explicit path.

Write only the justified document set: architecture using
`references/templates/architecture.md`, significant decisions using
`references/templates/adr.md`, prioritized debt, and instructions using
`references/templates/project-claude-md.md`. Label inferred historical rationale. Preserve
host AGENTS.md/CLAUDE.md conventions and keep path-specific rules at their proper scope.
Link authoritative content rather than duplicating source or adding a global active-task pointer.

For roughly more than ten crates, apply `references/large-workspace.md`: focus scope, exclude
generated/target trees, use symbol navigation and consider sparse worktrees. For authorized
per-crate context, use `references/templates/crate-context.md` and its four tests and 15-line
cap. Reuse collected findings; promote repeated facts to workspace instructions, omit empty
crates and place a single remaining fact in root context. Report crates considered/retained
and promotions. If most crates survive, check duplication again. Assign disjoint write zones
when delegating; preserve one owner per retained file. Read-only onboarding reports proposed
documents. Context capture never implies authorization to write memory.

## Finish or route

Report project, edition, MSRV, crate types, domains, applicable profiles/rules and tooling
presence. Onboard also returns the public-surface summary, prioritized findings, document
paths and three to five evidence-backed next actions. Distinguish documented assessment from
repair with COMPLETE / NEEDS WORK / BLOCKED for the requested scope.

For orient, build on any session-start summary and select one next workflow from the stated
goal: design-change for design, implement-change for implementation or diagnosis, review-work
for audits, verify-work for checks, or research-topic for ecosystem facts. Explain relevant
roles/profiles briefly. Resolve names against the host catalog, using qualified names or exact
paths on collisions. Explicit-only maintenance/publication entries are suggestions unless the
user invoked them. Ask only when the goal is materially ambiguous. If a sibling skill is
missing, authorized design/implementation can use the bundled Elephant lifecycle with its
freshness limits. Architecture/API work stays within that same context and design.

Without a manifest, supplied code can still receive review and a design question can still
receive design work. Project creation requires an explicit maintenance request. Request a
checkout only for work that needs one. A pure exploration ends with the map, without routing
into source changes.
