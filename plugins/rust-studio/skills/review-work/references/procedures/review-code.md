# Code, API and scope review

Use `references/maintainer-grade-development.md` for the maintainer bar,
`references/rust-guidelines.md` when relying on an external guideline, and
`references/verdicts.md` for intensity and verdicts. A read-only reviewer uses
`references/profiles/correctness.md`; design decisions also need an independent adversarial
lens using `references/profiles/adversarial.md`. Applicable domain profiles are knowledge,
not exclusive role assignments.

## Diff

Fix the diff identity and intended outcome. Default to working-tree changes, including staged
and untracked Rust files; a supplied ref changes the comparison. Read root and scoped standards,
including CODING_STANDARDS.md and CONTRIBUTING.md where present. Missing standards remain
unverified. An outer acceptance test is the observable scope anchor (`references/testing-model.md`).

Check the touched area for correctness, soundness, security, requirements, tests and shape:

- Drop order and named guards; best-effort Drop with explicit fallible close where needed.
- Dyn compatibility: generic methods and Self: Sized, async/RPITIT dispatch constraints.
- Variance and ownership markers in custom containers; FFI layout and packed field access.
- Typed library errors, borrow versus clone, sibling primitives and owning crate placement.
- Idioms appropriate to the actual MSRV: LazyLock/OnceLock, cfg_select!, raw references and
  atomic update APIs. Modernization must preserve callers, not merely match a preferred spelling.
- Accumulated exceptions, flags and Option fields against `references/types.md` design-drift
  tells; crate extraction and its counter-case in `references/architecture.md`. Wider accretion
  is a separate non-blocking escalation, not permission to reshape untouched code. Use the
  durable capture procedure in `references/procedures/review-structure.md` when authorized.

Mechanically inspect the selected diff for oracle weakening, then confirm every hit in context:
new ignored tests; deleted test attributes/files; net loss of assertions; equality checks
replaced with is_ok/is_err/is_some/is_none; added should_panic; CI skip/exclude/filter changes;
and new allow attributes on tests. Retain command output and actual counts. These checks are a
precondition, not proof that surviving assertions test the right behavior.

Before suggesting a branch or guard replacement, identify the boundary input/state protected
by the original, trace its producer/caller contract, and show preservation with an invariant,
characterization test or trace. If validity is unknown, label the simplification a hypothesis
and name the missing evidence. Happy-path green does not prove equivalence.

Select further read-only lenses only for domains entered by the diff:

| Domain | Profiles and checks |
|---|---|
| Public surface or library error | `references/profiles/api.md`; API-GATE and SemVer below |
| Unsafe, concurrency, hot paths | `references/profiles/systems.md`, `references/profiles/performance.md`; SAFETY/PERF gates |
| Async, handlers, jobs | `references/profiles/async.md`; ASYNC-GATE |
| CLI | `references/profiles/cli.md`; CLI-GATE |
| Tests | `references/profiles/testing.md`; QA-GATE |
| Build, feature matrix, CI | `references/profiles/tooling.md`; BUILD-GATE |
| Versions, MSRV, release | `references/profiles/release.md`; RELEASE-GATE |
| New files, modules, deps or model calls | `references/profiles/structure.md`; tree audit in `references/procedures/review-structure.md` |
| Auth, parsing, external input | `references/profiles/security.md`; security procedure in `references/procedures/review-risk.md` |
| FFI, embedded, WASM | `references/profiles/platforms.md` and applicable safety gates |
| Database, web, macros, telemetry | `references/profiles/data.md`, `references/profiles/web.md`, `references/profiles/macros.md`, `references/profiles/observability.md` |

Pasted code has no path-triggered rules: read each applicable profile and its domain rules.
Independent lenses receive the full diff and constraints, not earlier findings. Await every
selected lens before delivering one merged final report. Disclose unavailable independence.

Run the exact project gate (`references/project-gate.md`). Only without one use clippy
--all-targets with -D warnings and nextest (cargo test fallback), adding Miri for unsafe,
SemVer tools for public changes, and audit/deny for dependency changes. Distinguish executed
evidence from supplied logs. Report every supported finding, rank by severity, and decide the
verdict at the bar: BUG, SOUNDNESS/SAFETY, REDO, SCOPE/MAINTAINABILITY, TEST-GAP, INTEGRITY,
UNTRUSTED. REDO-TO-BAR applies to the touched area; speculative future abstraction stays out.

Check findings against prior reviews, recalled notes and project rules. A repeated finding
needs a proposed enforcement point: lint/CI, shared rule, or durable convention. A defect
missed by a previous review warrants a proposed regression fixture for that blind spot.
Propose the exact rule or fixture; applying it remains separately authorized work under
`references/memory-protocol.md` and the implementation lifecycle.

## API

Use `references/profiles/api.md` and `references/api.md`. Resolve the supplied baseline or most
recent published tag; an unavailable baseline requires the actual ref. Capture public-api diff,
`cargo semver-checks check-release --baseline-rev <ref>` and `cargo doc --no-deps` output.
For semver-checks versions documenting them, exit 100 means violations and 101 tool failure;
an infrastructure failure cannot establish API compatibility. When tools are unavailable,
report the limitation and available manual rustdoc/source/consumer evidence.

Classify every changed public item PATCH/MINOR/MAJOR, including feature-gated exports, trait
requirements, sealed/exhaustive changes, signatures and re-exports. Check accidental pub,
leaked internal types and documentation. A dependency major bump can break public type identity
even with green rustdoc-based checks: trace dependency types through exported signatures.
Verify claims that nobody uses a removed item against prior API and known/reverse consumers;
without that evidence retain the breaking classification.

Compatibility aliases/wrappers require deprecation naming the replacement and a removal version.
Adding non_exhaustive to an already published type can itself break consumers. For breaks,
present a version bump, staged deprecation or another supported migration with trade-offs.
An intentional hard break needs a Breaking changelog entry, before/after examples and migration
of examples, doc-tests and downstream members. Record unresolved product decisions; an audit
does not apply mitigations. Report highest-class bump, per-item evidence, API-GATE and the
remaining RELEASE-GATE requirements (version, changelog, MSRV, publish dry run).

## Scope

Resolve actual story/plan criteria before classifying the diff. Missing or ambiguous criteria
are a genuine input gap; preserve partial findings and mark the rest UNREVIEWED. Use
`references/profiles/architecture.md` for boundaries and scope. Return ADDED, MISSING and
MISALIGNED lists with criterion and file:line evidence, then IN SCOPE / OVER SCOPE / UNDER
SCOPE / MIXED. In active development, reshaping weak code genuinely touched by the story is
in scope; restructuring untouched code is added scope. Apply this symmetrically.

For non-trivial ADDED items record the user's keep/split/revert decision when not already made.
For MISSING items record address/defer without silently shrinking requirements. A split may
produce a prepared task and authorized durable capture through the structure procedure.
Remediation and re-review belong to the existing implementation lifecycle; classification alone
does not edit code or authorize a new story.
