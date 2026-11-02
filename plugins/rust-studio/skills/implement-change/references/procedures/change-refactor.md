# Preserve behavior while reshaping code

Scope must name a crate/module/path and observable invariants: API, return/error values,
error text, ordering, exit codes, emitted events and side effects. An intended behavior
change leaves this operation for a separately authorized change. Load implementation,
structure and applicable domain profiles. Read `references/builder-brief.md` for each
implementation handoff and `references/reading-mode.md` when execution is unavailable.

## Pin and calibrate before reshaping

1. Map every caller and test with a researcher; flag unsafe and cross-crate/API consequences.
   Run the exact project gate and record test count and lint state. A red baseline blocks
   attribution; diagnose it first. Record tree signals with `scripts/slop-audit.sh -p <crate>`.
2. Identify public effects with no value/effect assertion. An implementer with testing
   profile adds characterization tests recording today's behavior, including awkward cases.
   Preserve these green tests at an oracle ref: a commit only when authorized, or the hash
   from `git stash create` without storing or moving work. Document capture limitations
   such as untracked files and retain their content separately.
3. Calibrate one behavior by a controlled temporary break, observe red, and restore only
   that break. If tests stay green, add the missing observation or state the blind spot;
   subsequent greens prove compilation rather than that unobserved behavior. With no tools,
   present the characterization tests and proposed calibration as UNRUN before the reshape.

## Select and execute transformations

Combine lint signals with tree signals: duplicates, orphans, cycles, unreachable exports.
For simplification inspect cognitive complexity, long functions, excessive arguments,
type complexity, needless pass-by-value, large enums and boolean parameters without changing
the project's lint policy. Reading signals include intent-hiding names, stringly state,
invalid optional combinations, repeated exceptional branches, misplaced ownership and
obsolete wrappers/comments. Length alone does not establish a defect.

Rank concrete transformations and keep each step buildable: flatten control flow, name pure
operations, replace ambiguous internal flags, separate decisions from I/O, consolidate
behaviorally equivalent branches and remove only proven-dead paths. Use structural rename
tools for Rust symbols. Boundary/dependency-direction decisions need the design lifecycle;
the refactor cannot silently establish a new architecture.

An implementer performs one approved-scope step, reports diff and gate output, and stops
on red until that step is corrected. Characterization assertions remain fixed. Preserve
twin branches and public surface under the builder brief. Report deferred targets explicitly.

## Lock the oracle and review

Before independent review, compare test files and removed assertion/test/ignore/panic lines
against the oracle ref. Any weakened, removed or silenced test blocks the refactor pending
an explicit behavior decision; cosmetic test edits must also be accounted for. Final test
count equals baseline plus added characterization tests; a disappeared test is a finding.

Use a fresh reviewer for behavior, scope and idiom. Add API-GATE for public surface,
SAFETY-GATE for unsafe and ASYNC-GATE for async restructuring, with the corresponding
profiles and actual required checks. Repair findings under `references/review-repair.md`.

Report scope, baseline command/count/calibration, pinned behaviors, final gate/count,
slop-audit before/after, domain gates, decisions and deferred work. COMPLETE requires the
unchanged observable contract and evidence on the delivered tree; describe unverified
behavior plainly rather than treating green compilation as a substitute.
