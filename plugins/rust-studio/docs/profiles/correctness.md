# Correctness review

Use for a diff or implementation against an authorized contract. Read
`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`,
`${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md` and applicable path rules.

- Fix the baseline diff and acceptance denominator. Read bodies and real callers before
  judging; cite inspected lines, disclose sampling and retract disproved findings.
- Check logic, error propagation, overflow/casts/boundaries, ownership, RAII and lifetime
  behavior. A guard bound to `_` drops immediately; critical flush/commit/release needs
  explicit close. Verify local/field drop-order assumptions and async cleanup.
- Inspect manifest/edition migrations across gated modules and targets. Match edition to
  MSRV, reserved identifiers and cfg coverage. cargo fix compatibility rewrites may avoid
  new edition behavior (drop-order changes, raw-pointer syntax, escaped keywords); determine
  whether that avoidance was an intentional recorded choice.
- Check scope both ways: unrelated changes and missing requested cases/consumers/migration.
  No unresolved hard half of the request disappears behind a clean local diff.
- Load `testing.md` for criteria, oracle calibration, test integrity and the full denominator.
  Also check stubs/canned returns, unjustified lint allowances, workspace lint overrides and
  changes to CI/lint/timeouts that hide a failing implementation.
- Apply the maintainer bar to touched code: owning crate, sibling reuse, explicit domain
  types/errors, intent-revealing/unit-aware names and deliberate ownership. A compatibility
  shim in active development needs a real migration rationale. Clone/box/collect/Arc-Mutex
  workarounds require a model reason; current idioms must respect actual MSRV.
- Name each design-drift mechanism and its correction: closed string tags to enums,
  branch-selecting booleans to state, literal-only sibling branches to shared logic,
  repeated limits to one constant, deep nesting to explicit control flow, and decision I/O
  to a pure core with an effect boundary. Size alone is a lead; inspect responsibility and
  test-module placement before proposing a split.
- Check paired paths (forward/reverse, encode/decode, old/new) and adjacent stale claims.
  Defensive caps/timeouts/retry limits need a test reaching the bound. Documentation states
  invariants rather than private process IDs or duplicated change history.
- Load `api.md` for dyn/evolution/error contracts, `systems.md` for unsafe/variance/pinning,
  `async.md` for cancellation and `security.md` for hostile input or untrusted provenance.

Evidence must match the project's actual gate configuration; all-features success cannot
replace shipped-feature checks. Correctness, requirements, safety and integrity failures
yield NEEDS WORK; correct but unacceptable touched design yields REDO-TO-BAR. Missing
load-bearing evidence yields BLOCKED. Report all supported findings with severity, then
filter at the verdict; advice remains distinguishable from a demonstrated defect.
