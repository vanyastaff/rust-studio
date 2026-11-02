# Diagnose failures and repair confirmed causes

First distinguish diagnosis from authorized repair. Diagnosis-only uses read-only inspection
and existing repro commands, then ends with causal evidence or explicit hypotheses and the
next experiment. It does not edit source, add instrumentation or silently start a fix. Obtain
authorization for a necessary diagnostic write before making it. For a fix request, test and
instrumentation writes are part of the requested repair. Preserve partial reproduction evidence.

Read relevant project decisions and `references/memory-protocol.md` without assuming memory
writes are authorized. A researcher with the navigation profile maps definitions, callers,
state mutations and tests. Choose reviewer/verifier profiles for read-only diagnosis and an
implementer plus the corresponding profiles for authorized writes.

## Runtime diagnosis

1. Capture the exact command/input/environment for a public-path reproducer. Prefer controlled
   time or deterministic scheduling over timing guesses. Failure to reproduce leaves a
   hypothesis, not a confirmed defect or a reason to patch speculatively.
2. Write one to three falsifiable mechanisms. Test each with existing traces/backtraces,
   narrowing runs or bisect; for authorized repair add scoped instrumentation when needed.
   Use async/system profiles for cancellation, task ownership, lock order and memory ordering;
   an adversarial reviewer can challenge a design-level explanation.
3. Stop at the finding for diagnosis-only. For authorized repair, preserve a failing
   regression first, fix the owning abstraction, then prove green through the delivery
   procedure. Include typed error or tracing evidence where the failure would otherwise be
   silent; load the observability profile for that path.

Report ROOT CAUSE, EVIDENCE, FIX (or not requested), GUARD (or next experiment). Distinguish
COMPLETE diagnosis from COMPLETE repair. If causal evidence is missing, say NEEDS WORK and
list disproven hypotheses rather than inventing a cause.

## Compiler failures

1. Reproduce the exact failing Cargo command and retain full diagnostics, feature set,
   target and `rustc --version`. If none was supplied, check workspace/all targets. If it
   already compiles, report that and stop. For a nightly-only failure, compare the supported
   stable/project toolchain before attributing it to source; report a toolchain-only result
   without silently changing CI's toolchain.
2. An authorized implementer fixes the first root error and reruns the failing command;
   cascading diagnostics are not separate causes. Consult current API facts, restructure
   ownership at its owner, and avoid lints/unwraps/clones that conceal the defect.
3. A needed behavior or public API change outside the compiler repair scope is a design
   decision; preserve the diagnosis and resolve that decision first. Finish with the exact
   project gate and required feature matrix, not a feature set selected only because it passes.

Report each root error/code, mechanism and fix, followed by check/lint/test results. This
branch consumes the caller's existing repair budget rather than opening another loop.

## Intermittent tests

1. Map tests and fixtures, then stress with retries disabled and recorded concurrency/order,
   for at least five runs or until failure. Vary property-test seeds explicitly and record
   seeds, rate, trace and environment. If ten runs reveal no failure, report that bound and
   obtain a larger campaign budget before continuing; absence of a failure is not a cure.
2. Diagnose clock/time, port binding, shared globals, ordering, external I/O and property
   seeds. Record responsible expressions and HIGH / MEDIUM / LOW confidence. Compare two
   to four viable remedies when there is a choice. Low confidence calls for another
   experiment; it cannot justify an asserted fix.
3. Under the authorized fix plan, replace the source of nondeterminism: controlled clock,
   OS-assigned port, isolated state/tempdir, meaningful ordering or a pinned regression seed.
   Confirm ten consecutive clean stress runs with retries disabled, the project lint/fmt
   gate, independent correctness review and QA-GATE from a fresh verifier with testing profile.
4. Quarantine is a separate deliberate deferral requiring explicit authorization. Use an
   ignore reason containing the tracking issue URL and diagnosis; prepare the issue first,
   and post it only with authorization. A bare ignore or retries that hide failure do not
   establish a fix. Report quarantine separately from successful repair.

Report test count, before/after failure rate, cause, confidence, fix or quarantine and actual
gates. Fewer than ten clean post-fix runs or missing required evidence remains NEEDS WORK.
