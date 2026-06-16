# Ground truth — architecture/runtime-type-in-definition-crate (verdict: RESHAPE NEEDED)

> Mapped agent is `chief-architect` (a pre-code lead), whose reject token is
> **RESHAPE NEEDED**. `REDO-TO-BAR` is the `rust-reviewer` equivalent — accept either as
> "rejected the shape".

A workflow *definition* crate that, against its own stated contract ("not the execution state
machine"), holds a per-node *runtime* state machine and exposes it. Compiles fine; the placement
and the attribute are both boundary/semver mistakes that get harder to undo once published.

| id   | line | type                         | severity | defect |
|------|------|------------------------------|----------|--------|
| GT-1 | 9    | BOUNDARY (wrong crate)       | 🔴 | `NodeState` is per-node *runtime* execution state (Pending/Running/Failed/WaitingRetry), but it lives in the *definition* crate whose own README disclaims runtime state. Definition-time shape and run-time state are different concepts with different owners — this FSM belongs in `acme-execution`. Re-exporting it on the public definition surface compounds the error by making a runtime type part of the published API. |
| GT-2 | 8    | NON_EXHAUSTIVE (misapplied)  | 🟠 | `#[non_exhaustive]` on a state machine that a sibling crate must transition forces a `_` arm cross-crate, suppressing the exhaustiveness check you actually want: a new variant compiles and falls through silently instead of erroring at the transition site. `#[non_exhaustive]` is for growable surfaces where downstream forward-compat outweighs exhaustiveness; an internal FSM the workspace must handle completely is the opposite case. |

Pass = the agent returns a reject verdict (**RESHAPE NEEDED** / REDO-TO-BAR) and flags **both**:
the runtime FSM living in (and being re-exported from) the definition crate, and
`#[non_exhaustive]` defeating the exhaustiveness check on a state machine the workspace must
handle completely. "It compiles, the states look reasonable" is a fail.
