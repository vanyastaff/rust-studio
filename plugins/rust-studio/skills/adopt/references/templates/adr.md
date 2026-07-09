<!-- Rust Code Studio template — copy this file into your project and fill in every placeholder. -->

# ADR NNNN: <title>

*Short, imperative phrase: e.g. "Use `tokio` as the async runtime" or "Replace `serde_json` with `simd-json` in hot path".*

---

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Deciders:** *Names or GitHub handles of everyone who signed off.*

---

## Context

*What forces, constraints, or pain points drove this decision? Include relevant Rust-specific details: edition, MSRV, target platforms (x86-64, WASM, embedded), `#[no_std]` requirements, compile-time impact, crate ecosystem limitations, or prior art that was evaluated.*

---

## Decision

*State exactly what will be done. Use active voice: "We will …". Include the chosen crate(s) and version constraints if applicable, any feature flags enabled, and the public API or module boundary affected.*

---

## Consequences

**Positive**

- *e.g. Reduced unsafe surface, better compile-time guarantees, smaller binary size.*

**Negative / Trade-offs**

- *e.g. MSRV bump, increased compile time, additional transitive dependencies, migration effort.*

**Follow-ups**

- *Open tasks or issues created as a result of this decision. Link to tracking issues.*

---

## Alternatives Considered

| Option | Why rejected |
|---|---|
| *e.g. `async-std` runtime* | *e.g. Smaller ecosystem; `tokio` dominates the dependency graph already.* |
| *e.g. Stay synchronous* | *e.g. Blocking I/O unacceptable under the latency budget.* |

---

## References

- *Issue / PR: e.g. https://github.com/org/repo/issues/42*
- *Benchmark results: e.g. `benches/throughput.rs` — criterion report linked in PR.*
- *Related ADRs: e.g. ADR-0003 (async runtime choice), ADR-0007 (serialization strategy).*
- *Upstream docs / RFC: e.g. https://tokio.rs/tokio/tutorial*
