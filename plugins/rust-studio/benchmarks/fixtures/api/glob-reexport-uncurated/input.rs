//! crate: `acme-sdk` 1.x — the ONLY published crate in this workspace. Every other crate
//! (`acme-engine`, `acme-graph`, …) is an internal impl-detail with no external semver.
//! The whole point of a single public crate is a *curated* surface. Two lines below throw
//! that away: they republish internal crates wholesale, so every current AND future `pub`
//! item in them silently becomes part of `acme-sdk`'s 1.x contract.

/// Curated, intentional surface — this is the shape we actually mean to support.
pub mod prelude {
    pub use acme_engine::{Workflow, WorkflowBuilder, WorkflowError};
}

// Re-exports the ENTIRE internal crate as a public module. `acme_sdk::acme_engine::<anything>`
// now resolves, including types we never meant to expose — and anything added to `acme-engine`
// later joins the public API without anyone deciding to.
pub use acme_engine;

// Glob re-export of an internal module: pulls every `pub` item out of `acme_graph::graph`,
// including the petgraph-backed index types that are pure implementation detail.
pub use acme_graph::graph::*;
