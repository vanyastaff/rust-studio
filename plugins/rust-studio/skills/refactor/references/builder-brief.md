# The builder brief — what `/refactor` hands `rust-builder` for every step

The standing brief `/refactor` passes with each approved step. The step itself and its scope
boundary come from the approved plan; the five rules below are the same for every step of every
refactor, which is why they live here rather than being restated in the plan each time.

## The brief

1. **One step, its boundary.** The single approved step description and the scope boundary settled
   in Phase 4. Nothing beyond them.
2. **No other changes.** No "while I'm here" cleanups, and no new dependency: a crate the reshape
   seems to need is a `/add-dep` question for the user, not a line in `Cargo.toml`.
3. **The twin-branch rule.** Two paths that differ in one detail (a floor on one and not the other,
   an off-by-one, a different error string) are **not** duplication to unify. The difference is
   behavior, and "this normalization is safe" is exactly the argument a refactor is not allowed to
   make. Extract what is identical, keep what differs, and record the asymmetry under `DEFERRED`
   as a `/dev-task` question for the owner.
4. **Gate after every step.** Apply the change as targeted edits, then run the project's gate (the
   exact command recorded in Phase 2, step 5) together with `cargo fmt`.
5. **`unsafe` in scope.** Also `cargo +nightly miri test`, where it is feasible.

## What comes back

The diff and the gate output for that step, every time. A step reported without them is not
finished, whatever the code looks like.
