# Coverage, mutation and fuzz evidence

Use `references/profiles/testing.md`, `references/testing-model.md` and
`references/integrity-and-evidence.md`. Measurement is the default. If the user requests test
or target authoring, give an implementer the precise behavioral outcome and permitted test/fuzz
paths; a different fresh verifier evaluates the result. Failure in production code returns to
authorized implement-change work. A campaign does not silently grant repair or commit authority.

The coordinator runs artifact-producing measurement commands and retains LCOV reports, mutation
results, corpus additions and crash/minimization artifacts outside maintained source/test inputs.
Use separate output or scratch directories so a campaign cannot rewrite a checked-in corpus.
The fresh verifier inspects that evidence, distinguishes supplied runs from its own executions,
and may rerun checks that leave maintained artifacts unchanged. It returns results without
writing reports or adding retained fixtures; an authorized coordinator or implementer owns those
writes. Ordinary build/cache output remains permitted.

## Coverage

State package or workspace scope. Prefer cargo llvm-cov, with tarpaulin fallback and disclosed
limitations. Use the project feature/target matrix; without one start with the shipped default
configuration and justified supported profiles. Use all features only when that combination is
supported. Produce an LCOV artifact and summary. Missing tools, linker or proc-macro failures
remain explicit; line-count heuristics are advisory and cannot substitute for coverage.

Report overall and per-module line/branch measurements plus uncovered counts; mark unsupported
branch metrics unavailable. Rank up to ten consequential gaps: error paths, boundary values,
state transitions and public APIs, with source evidence and concrete input/expected-output
test proposals. Deprioritize generated code, test helpers, getters and formatting. A testing
reviewer checks behavioral risk and flakiness of proposals.

Use project targets; absent those, 80% branch coverage for error/public paths and 70% line
coverage for helpers are discussion floors, not an invitation to chase 100%. Coverage measures
execution, not assertion quality: flag vacuous tests and retain skipped/ignored/excluded cases.
For requested gap tests, rerun the tests and coverage and report before/after for affected
modules, gaps closed and gaps outside scope. Infrastructure-dependent gaps remain explicit
integration requirements, not silently dropped cases.

## Mutation

Check cargo-mutants availability and a green, stable baseline using the project's configured
runner. Baseline failures invalidate the campaign and return to diagnosis. Estimate cost with
`cargo mutants --list` and suite time; choose and state a bounded high-risk scope, narrowing or
sharding large workspaces. Honor the runner (for example --test-tool=nextest), explicit jobs and
timeout multiplier, and retain mutants.out results. Report an unignored artifact directory;
changing ignore/configuration files requires requested configuration scope.

Recall applicable prior accepted misses under `references/memory-protocol.md` and verify them
before using them. Classify missed/caught/timeout/unviable, then rank misses by behavior:
error handling, boundary math, state arms, unsafe/money/time/auth first; cosmetic/logging and
correct-but-slower cases may be accepted with a reason. Report up to ten prioritized misses
while retaining the complete results and denominator. A testing reviewer proposes the smallest
assertion/input that would catch each real miss and identifies dead code separately.

For requested stronger tests, acceptance is the exact mutation changing missed to caught in
a narrowed rerun, matched by name in caught.txt; a new green test alone is insufficient.
Report total/caught/missed before and after, accepted misses, and score for the actual scope:
(caught + timeout) / viable. Name exclusions, interruption and remaining scope. Preserve
completed results after interruption; do not invent a full score. CI wiring belongs to
configure-tooling; an incremental --in-diff campaign is an option, not automatic mutation work.

## Fuzz

Verify nightly, cargo-fuzz and platform sanitizer/libFuzzer support before promising a campaign;
unavailable support is BLOCKED, not a silent code-review substitute. Recall relevant target and
crash history under the memory protocol, verify it and explain any ranking change. Map actual
surfaces: untrusted parsers/decoders, unsafe boundaries, custom deserialization and stateful
operation sequences. Rank up to five; prefer the named target or the top two when unspecified.
Already-validated boundaries and generated code have lower value. New production constructors
or API changes needed for fuzzability require an implementation/design decision.

For explicitly requested targets, an implementer initializes fuzz/ once and writes one target
per selected surface. Prefer Arbitrary for structured input, meaningful roundtrip/output/state
properties where available, deterministic hot paths without I/O/globals/printing, and real valid
corpus seeds. Confirm fuzz/Cargo.toml stays isolated from the workspace. Build with
`cargo +nightly fuzz build` and retain output. An existing-target campaign does not implicitly
authorize adding targets.

Run each target with an explicit time/timeout budget, default:
`cargo +nightly fuzz run <target> -- -max_total_time=300 -timeout=10`.
Report wall time and coverage feedback; instant plateaus or empty corpora limit the conclusion.
Only a confirmed intentional leak justifies a leak-detection exception; never suppress UB.

Retain every crash artifact. Minimize with cargo +nightly fuzz tmin, classify contract panic
versus sanitizer UB, and obtain a read-only systems/soundness review for UB. Preserve raw
artifacts and the reason when minimization fails. Requested regression tests replay minimized
inputs in ordinary CI tests, not only corpus files; production fixes require root-cause diagnosis
and implement-change. After authorized repair, replay the artifact and rerun the target.

Report targets built/run, budgets/final cov counts, and crashes found/minimized/fixed/regression-
tested as four separate counts with every gap explained. A bounded crash-free run is not proof
of safety. Suggest authorized CI corpus caching and artifact retention through configure-tooling
where useful. Durable findings remain proposed memory until host/user authorization permits
capture. End COMPLETE / NEEDS WORK / BLOCKED for the requested scope, with unresolved crashes
and missing capabilities visible.
