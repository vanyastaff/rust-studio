# Architecture and scope

Use for crate/module boundaries, ownership, cross-crate changes and acceptance planning.
Read `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`,
`${CLAUDE_PLUGIN_ROOT}/rules/architecture.md` and the governing project ADRs.

## Structural checks

- Map dependency direction, domain ownership, real consumers and the existing primitive
  that may already solve the problem. Core/domain state stays independent of UI and I/O.
- Split structs for independent borrowing only when the parts represent domain concepts.
  A borrow conflict can expose wrong ownership; grouping fields alone does not settle it.
- Justify a new crate by a public boundary, selectable capability or measured compilation
  benefit. Account for version skew, clean-build cost, lost cross-crate optimization and
  feature unification; consider thin LTO or cargo-hakari where the workspace warrants it.
- Keep each production constant, configuration value and invariant in one home; re-export
  it where needed. Keep test expected results independent from implementation calculations.
- Traits express real substitution/ownership needs, focused contracts and intentional
  extension points. Implementations preserve their advertised contract. Use composition;
  an owning type's `Deref` is not an inheritance mechanism. Avoid premature abstraction.
- Separate queries from mutations, including hidden interior mutation. Evaluate AFIT,
  RPITIT, GATs, sealing, non-exhaustiveness and typestate against actual consumer needs.
- Trace lifecycle, failure/recovery, migration and obsolete-path removal through every
  affected consumer. A partial ripple is unfinished work, not an implicit scope reduction.

## ARCH-GATE

Boundaries and acyclic dependencies are justified; consequential decisions have an ADR;
public contracts are deliberate (load `api.md`); sibling reuse and single ownership are
checked; no hidden coupling prevents implementation. State how the chosen boundary handles
the next three plausible extensions over two years, without implementing speculative features.

## SCOPE-GATE

Every acceptance criterion has an observable proof task. Each task has an owner, write
scope and dependencies; the critical path and blockers are explicit. Enumerate cross-domain
ripples and non-goals. Check both excess scope and missing requested behavior. Scope cuts
are explicit decisions and cannot silently remove correctness, ownership or required tests.
In active development, reshaping weak code touched by the authorized work is in scope;
unrelated restructuring remains separate. Return the plan and criterion-to-task mapping.
