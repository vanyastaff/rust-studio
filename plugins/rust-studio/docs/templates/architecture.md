<!-- Rust Code Studio template — copy into your project and fill in the blanks. -->

# Architecture: <crate/workspace>

*Replace `<crate/workspace>` with the top-level crate name or workspace root name.*

---

## Overview

*One paragraph. What does this crate/workspace do, who calls it, and what is the single most important design decision? Aim for 3–5 sentences a new team member can read in 30 seconds.*

---

## Context & constraints

*List the non-negotiable constraints that shape every design choice. Examples: MSRV, no-std/no-alloc, must be `Send + Sync`, latency SLO, binary size budget, embedded target, WASM target, stable-only API, semver guarantees.*

- **MSRV:** <!-- e.g. 1.75 -->
- **Targets:** <!-- e.g. x86_64-unknown-linux-gnu, wasm32-unknown-unknown -->
- **Stdlib / allocator:** <!-- std / no_std / no_std + alloc -->
- **Stability contract:** <!-- e.g. semver, internal-only, nightly-ok -->
- **Other hard constraints:** <!-- latency, memory, safety invariants, FFI boundary, ... -->

---

## Crate / module map

*Paste or sketch the directory/module tree. Annotate each node with one-line purpose. For a workspace, list member crates first, then their public modules.*

```
<workspace-root>/
├── crates/
│   ├── <core-crate>/          # <!-- e.g. pure domain logic, no I/O -->
│   │   ├── src/
│   │   │   ├── lib.rs         # <!-- re-exports public surface -->
│   │   │   ├── <module-a>.rs  # <!-- what it owns -->
│   │   │   └── <module-b>/
│   │   │       ├── mod.rs
│   │   │       └── ...
│   ├── <io-crate>/            # <!-- e.g. async I/O, network, file -->
│   └── <cli-crate>/           # <!-- e.g. binary entry point -->
└── Cargo.toml                 # <!-- workspace manifest -->
```

---

## Dependency direction

*Draw the acyclic dependency graph. Arrow means "depends on". No cycles allowed — call out any deliberate `dev-dependencies` exceptions.*

```
<cli-crate>
    └── <io-crate>
            └── <core-crate>   ← no upstream deps inside the workspace
```

*External crate dependencies worth calling out (version-pinned, forked, or unusual):*

- `<crate>` — *reason it is used / any version-pin caveat*

---

## Key types & traits

*List the load-bearing public types and traits. A reader should be able to build a mental model without opening source files.*

*For each boundary item, consider whether a modern Rust feature encodes the contract better than a plain trait/enum: AFIT/RPITIT, GATs, sealed traits, `#[non_exhaustive]`, typestate, or a newtype/smart-constructor that makes illegal states unrepresentable. Note the chosen encoding in the Purpose column where it is load-bearing (per `docs/maintainer-grade-development.md` — structural guarantees over caller discipline).*

| Item | Kind | Crate | Purpose (note structural encoding where load-bearing) |
|------|------|-------|---------|
| `<TypeName>` | `struct` | `<crate>` | *What it represents; lifetime params; newtype/typestate invariant if any* |
| `<TraitName>` | `trait` | `<crate>` | *Contract it enforces; key methods; sealed / RPITIT / GAT if used* |
| `<EnumName>` | `enum` | `<crate>` | *Variant semantics; `#[non_exhaustive]` if extensible* |
| `<TypeAlias>` | `type` | `<crate>` | *What complexity it hides* |

*Trait implementation matrix (only notable impls):*

| Type | Implements |
|------|-----------|
| `<TypeName>` | `<Trait1>`, `<Trait2>` |

---

## Data flow

*Describe the happy-path lifecycle of the main input from entry point to output. Use a numbered list or a simple ASCII diagram. Call out where ownership transfers, where data is cloned, and where async boundaries cross.*

```
[entry point]
    │  raw bytes / CLI args
    ▼
[parse / deserialize]          -- returns owned value; no borrow past here
    │  <DomainType>
    ▼
[validate / enrich]            -- may return Err early
    │  <ValidatedType>
    ▼
[core processing]              -- pure; no I/O
    │  <OutputType>
    ▼
[serialize / emit]             -- I/O; async if applicable
    │
[caller / stdout / network]
```

---

## Concurrency model

*State the concurrency strategy. Be specific: which async runtime (if any), thread-pool configuration, shared state primitives, actor pattern, etc.*

- **Runtime:** <!-- e.g. Tokio multi-thread, single-thread, none (sync) -->
- **Shared state:** <!-- e.g. Arc<Mutex<T>>, DashMap, channels only, immutable after init -->
- **Thread model:** <!-- e.g. one thread per connection, rayon for CPU work, ... -->
- **Send/Sync bounds:** <!-- e.g. all public API types are Send + Sync, or explain why not -->
- **Blocking calls:** <!-- where sync work is offloaded, e.g. spawn_blocking -->

---

## Error strategy

*Describe how errors are represented, propagated, and surfaced. Reference specific types.*

- **Error type(s):** <!-- e.g. a single crate-level `Error` enum, thiserror-derived; or anyhow in binaries -->
- **Propagation:** <!-- e.g. `?` everywhere; no panics in library code -->
- **Panics policy:** <!-- e.g. only on programmer error (index OOB); document with `# Panics` -->
- **Logging / tracing:** <!-- e.g. `tracing` spans on every public async fn -->
- **Retry / recovery:** <!-- e.g. callers own retry; library surfaces transient vs. fatal variants -->

---

## Forward vision

*The 2-year / 3-extension view (per `docs/maintainer-grade-development.md` — responsibilities distributed so the design extends cleanly). Name the most likely next extensions and check the structure survives them.*

- **Likely extension 1:** <!-- e.g. a second backend / transport / format --> — *does responsibility still sit in the owning crate, or does this force an upward dependency / a god-crate?*
- **Likely extension 2:** <!-- e.g. async variant, new tenant dimension --> — *what new boundary or ownership shift would it need?*
- **Likely extension 3:** <!-- e.g. external consumers / public surface --> — *does the type/trait shape (sealed / `#[non_exhaustive]` / typestate) absorb it without a breaking churn?*

*After these three extensions, does responsibility still sit in the right crate? If "no" for any, reshape the boundary now — a wrong-crate concept compounds. If "yes", say why the boundaries hold.*

---

## Risks & open questions

*Honest list of known rough edges, unproven assumptions, and deferred decisions. Review and prune at each milestone.*

| # | Risk / question | Severity | Owner | Status |
|---|----------------|----------|-------|--------|
| 1 | *e.g. Mutex contention under high concurrency not benchmarked* | Medium | — | Open |
| 2 | *e.g. MSRV may need to drop if dependency raises minimum* | Low | — | Monitoring |
| 3 | *e.g. Unsound if caller violates X invariant — needs audit* | High | — | Open |
