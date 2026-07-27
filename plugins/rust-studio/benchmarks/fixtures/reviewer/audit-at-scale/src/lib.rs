//! crate: `edge-ingest` — parses untrusted request data for the edge gateway.
//!
//! House rule for this crate: every public entry point that consumes attacker-controlled
//! bytes enforces a size limit *before* it allocates or decodes.
pub mod codec;
pub mod ingest;
pub mod limits;
pub mod net;

#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    TooLarge { got: usize, max: usize },
    TooDeep { got: usize, max: usize },
    Malformed,
}
