# Plan feature tests

Load `references/profiles/testing.md`, `references/testing.md` and applicable domain
profiles. Map the feature, acceptance criteria, existing tests, fixtures/helpers and module
under test. If the implementation does not exist, plan against the spec and label the gap.
Infer missing criteria from available evidence and mark them as inferred; unresolved behavior
that changes the oracle remains a decision to resolve.

Map every criterion to concrete test cases. Choose unit tests for isolated logic, integration
tests for interacting components and real I/O, doctests for public caller examples, property
tests for general laws, and benchmarks for relevant performance regressions. For each case
record the tested function/module, input class, expected observable behavior and criterion.

Evaluate empty/zero/default, maximum/overflow/full, first/last and range boundaries,
Unicode/RTL/NUL/non-UTF-8 where accepted, and concurrency/order/cancellation/Send/Sync cases.
Explain inapplicable categories. Where laws apply, state them in plain English with proposed
proptest/quickcheck strategies: round-trip, idempotence, identity, commutativity/associativity,
monotonicity and invariant preservation.

The coordinator writes the requested plan using `references/templates/test-plan.md`, in
the project-specified location or alongside the existing spec. Include ordered test IDs,
types, criterion mappings, inputs/outcomes, edge matrix, laws, file/module locations and
fixtures. Identify QA-GATE and relevant PERF-GATE or SAFETY-GATE checks. A designer supplies
analysis and a fresh verifier with the testing profile evaluates coverage independently.

Completion is a plan with every criterion mapped or explicitly unresolved, not authored
tests or a measured coverage claim. Test-plan-only requests stop here. Requested harness
setup uses `/configure-tooling` in tests mode; authorized feature implementation uses the
same plan in the Elephant lifecycle. Test/fuzz-target authoring and measurement are distinct
outcomes under `/verify-work`; choosing those checks in a plan does not run or authorize them.
