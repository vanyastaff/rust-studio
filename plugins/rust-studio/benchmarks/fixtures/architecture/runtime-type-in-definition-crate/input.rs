//! crate: `acme-workflow` — workflow *definition* + DAG + activation-time validation.
//! Per its own README this crate is "not the execution state machine (that is
//! `acme-execution`)". The enum below contradicts that: it is the per-node *runtime*
//! state machine, it lives in the definition crate, and it is re-exported on the public
//! surface (`pub use state::NodeState;` in lib.rs).

/// The execution state of a single node within a workflow run.
#[non_exhaustive]
pub enum NodeState {
    /// Not yet evaluated; waiting for predecessors.
    Pending,
    /// Currently executing.
    Running,
    /// Finished successfully.
    Completed,
    /// Finished with an error.
    Failed,
    /// Failed but a retry is scheduled.
    WaitingRetry,
}

// ---- below: how the SEPARATE `acme-execution` crate is forced to consume it ----
// `acme-execution` drives the real transitions and must handle every state. Because
// `NodeState` is `#[non_exhaustive]`, a cross-crate `match` cannot be exhaustive — the
// consumer is forced to add a `_` arm, so a new variant added here (e.g. `Cancelled`)
// compiles and falls through it instead of producing the error at the one site that must
// learn to handle it.
pub fn advance(state: NodeState) -> NodeState {
    match state {
        NodeState::Pending => NodeState::Running,
        NodeState::Running => NodeState::Completed,
        NodeState::Failed => NodeState::WaitingRetry,
        _ => state,
    }
}
