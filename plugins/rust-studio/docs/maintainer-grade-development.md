# Maintainer-Grade Development Standard

This standard exists to prevent junior-level local patches from becoming the anchor for
review. Code is not treated as a contract until the design has passed a pre-code
maintainer review. Existing code is context, not authority: if the local shape is weak,
duplicated, non-idiomatic, or hostile to the workspace architecture, reshape the affected
area before implementing the feature.

## Sources Checked

Checked on 2026-06-14:

- Google Engineering Practices, "The Standard of Code Review":
  https://google.github.io/eng-practices/review/reviewer/standard.html
- Software Engineering at Google:
  https://abseil.io/resources/swe-book/html/toc.html
- John Ousterhout, A Philosophy of Software Design:
  https://web.stanford.edu/~ouster/cgi-bin/aposd.php
- Martin Fowler, Refactoring:
  https://martinfowler.com/books/refactoring.html
- Shape Up:
  https://basecamp.com/shapeup
- Rust API Guidelines:
  https://rust-lang.github.io/api-guidelines/
- Rust Performance Book:
  https://nnethercote.github.io/perf-book/
- Cargo Workspaces:
  https://doc.rust-lang.org/cargo/reference/workspaces.html
- Rust std docs and release blog for current toolchain freshness:
  https://doc.rust-lang.org/stable/std/
  https://blog.rust-lang.org/2026/05/28/Rust-1.96.0/
- Rust Design Patterns:
  https://rust-unofficial.github.io/patterns/
- Team Topologies key concepts:
  https://teamtopologies.com/key-concepts
- DORA delivery metrics:
  https://dora.dev/guides/dora-metrics/
- Parse, don't validate:
  https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- DDD Starter Modelling Process:
  https://github.com/ddd-crew/ddd-starter-modelling-process

These sources are not cargo cult rules. They inform the gate below. Local project
constraints still win when they are explicit and correct.

## Non-Negotiable Axiom

Every non-trivial implementation must be shaped before code is written:

1. The problem is understood.
2. The ownership boundary is known.
3. Existing workspace solutions are checked.
4. Prior ecosystem art is checked when relevant.
5. The API shape is idiomatic Rust.
6. The performance posture is explicit.
7. The implementation plan would improve long-term code health.

If any item fails, do not write the junior patch and hope review fixes it. Reshape first.

## Pre-Code Maintainer Gate

Before the first source edit, the orchestrator or lead must produce a short
`Maintainer-grade pre-code verdict`:

- `ACCEPTABLE`: the plan can go to `rust-builder`.
- `RESHAPE NEEDED`: the current structure or plan would produce weak code; reshape the
  affected area before implementation.
- `BLOCKED`: a load-bearing decision, missing evidence, or external constraint prevents a
  correct plan.

The verdict must answer:

1. What crate owns the concept being changed?
2. Which sibling crates already expose related primitives, helpers, traits, or error types?
3. Which existing APIs, types, or patterns should be reused instead of adding another helper?
4. Is this public API, cross-crate behavior, async/runtime topology, data layout, error
   taxonomy, unsafe, security-sensitive, or hot-path code?
5. What would a strict maintainer reject in the proposed design?
6. What breaking changes are allowed because the workspace is in active development?
7. Which official docs, docs.rs pages, crate changelogs, release notes, or peer projects were
   checked when the answer depends on current ecosystem behavior?

## Maintainer Rejection Test

Assume the patch will be reviewed by maintainers of a serious Rust crate. Reject the plan
before writing code if it has any of these problems:

- It adds logic to the wrong crate because that was the easiest edit site.
- It duplicates an abstraction already owned by a sibling crate.
- It preserves a bad API with a shim, adapter, alias, or "migrate later" TODO in active-dev
  mode.
- It relies on a stringly typed protocol, `bool` flags, unstructured `Option`, or broad
  `Box<dyn Error>` where a domain type, enum, newtype, or typed error should encode intent.
- It clones, collects, boxes, allocates, or uses `Arc<Mutex<_>>` to satisfy the borrow checker
  without checking whether borrowing, ownership, data layout, or API shape should change.
- It uses `async-trait`, trait objects, dynamic dispatch, or type erasure without a concrete
  need for object safety or heterogeneity.
- It optimizes without a benchmark/profiling reason, or claims performance without evidence.
- It adds an abstraction only because a pattern name exists.
- It follows local bad style even though changing the touched area would improve code health.
- It proceeds from stale Rust or crate knowledge without checking current docs.

## Rust Design Bar

For every touched API, prefer structural guarantees over caller discipline:

- Encode invariants with newtypes, enums, typestate, sealed traits, private fields, smart
  constructors, and RAII guards.
- Parse once into a stronger type instead of validating repeatedly downstream.
- Use standard traits (`From`, `TryFrom`, `AsRef`, `Borrow`, `IntoIterator`, `Extend`,
  `FromIterator`, `Display`, `Debug`) where they make integration idiomatic.
- Prefer caller-controlled copying and borrowing. Return borrowed views, iterators, or
  `Cow` where that is the right contract; do not make lifetimes disappear through needless
  allocation.
- Keep generic bounds on functions and impls, not on data structures, unless the field layout
  genuinely requires the bound.
- Use `impl Trait`, AFIT/RPITIT, GATs, associated types, or concrete generics when they encode
  the contract better than boxing or dynamic dispatch.
- Mark extensible public enums `#[non_exhaustive]` when the crate is published or has external
  consumers. In solo active-dev workspaces, breaking the enum can be better than carrying a
  compatibility layer.

### Language-Correctness Floor

The design bar is about quality; beneath it sits a separate, non-negotiable floor of hard
language-correctness rules. A change can read as well-shaped and still be wrong if it violates
the floor. These rules are not a matter of taste or active-dev latitude — they govern undefined
behavior, layout, dispatch, and teardown, and they hold regardless of how the design scores. They
are codified in focused `${CLAUDE_PLUGIN_ROOT}/rules/` files; every touched line must satisfy them:

- `unsafe.md`: the UB catalog (no data races, dangling/misaligned derefs, aliasing violations,
  invalid values in any field — uninit reads, out-of-range `bool`/`char`, bad discriminants);
  `#[repr(C)]`/`transparent`/`packed` layout discipline; `&raw const/mut` instead of building a
  reference to take a pointer; `MaybeUninit` write-before-`assume_init` for uninitialized data.
- `types.md`: variance and the `PhantomData` rule for generics absent from fields; dyn-compatibility
  (no `Self: Sized` supertrait, generic methods gated `where Self: Sized`, explicit auto traits on
  `dyn`); coherence and the orphan rule (newtype-wrap foreign types rather than impl across crates).
- `async.md`: `Drop` cannot `.await` — provide an explicit async `close()` and treat `Drop` as
  best-effort teardown; bind RAII guards in a `let` so their scope is obvious, never across a bare
  `match` scrutinee or behind a `_` binding that drops them early.
- `ffi.md`: ABI correctness, no unwinding across an `extern` boundary that forbids it, and sound
  string handling across the FFI edge (length/encoding/nul-termination, no borrowed-pointer escapes).

These are distinct from the design-quality bar above: passing the maintainer rejection test does
not exempt a change from the floor, and a floor violation is a defect even when the shape is good.

## Architecture Bar

Multi-crate Rust workspaces need explicit ownership boundaries:

- The crate that owns the concept owns the type, error, trait, builder, parser, and invariant.
- Higher layers may depend on lower layers; lower layers do not reach upward.
- Re-exporting another crate's type through a public API is an ownership decision, not a
  convenience.
- Workspace-level dependencies, lints, package metadata, and `Cargo.lock` are managed at the
  workspace root when they affect more than one member.
- ADRs are revisable in active development. If following an ADR forces a workaround, supersede
  the ADR with fresh evidence rather than patching around it.
- A correct breaking migration beats a compatibility shim in solo active-dev mode.

## Performance Bar

Performance work starts with posture, not micro-optimizations:

- Classify the path: cold, routine, hot, allocation-sensitive, latency-sensitive, memory-bound,
  CPU-bound, IO-bound, or compile-time-sensitive.
- Do not claim "fast" without evidence. Use `criterion`, `cargo bench`, `hyperfine`,
  allocation profiling, flamegraphs, `samply`, `perf`, or platform-appropriate profiling.
- Treat heap allocation as a design choice. `Vec`, `String`, `Box`, `HashMap`, `Rc`, `Arc`,
  `clone`, `to_owned`, `to_string`, and `format!` can allocate or amplify allocation cost.
- Use `Vec::with_capacity`, collection reuse, slices, `Cow`, `Bytes`, `SmallVec`, or `ArrayVec`
  only when the data distribution and benchmark/profiling evidence justify them.
- Avoid `Arc<Mutex<_>>` as the default concurrency answer. First consider ownership transfer,
  channels, immutable sharing, sharding, lock-free atomics, scoped tasks, or runtime-specific
  primitives.
- Unsafe, SIMD, custom allocators, and cache-layout changes require a benchmark, a safety
  argument, and a simpler rejected alternative.

## Product Philosophy Bar

Product and engineering decisions are joined:

- Shape the work before building: define the problem, appetite, solution outline, risks,
  rabbit holes, and no-go boundaries.
- Prefer outcomes over task completion. A task is not done because code compiles; it is done
  when the user-facing or maintainer-facing outcome is correct.
- In R&D/active-development mode, senior engineers spike or reshape the core architecture early
  so the product is not built on temporary scaffolding.
- Scope can be cut; quality bar cannot. Cut optional behavior, not invariants, ownership,
  tests, observability, or API correctness.
- Optimize for flow through the workspace: fewer ambiguous boundaries, fewer cross-crate
  handoffs, lower cognitive load, and clearer ownership.

## Required Builder Behavior

`rust-builder` must not blindly execute a weak plan.

- If the pre-code verdict is missing for a non-trivial task, return to the orchestrator before
  editing.
- If the plan fails the maintainer rejection test but the correct reshape is within the
  approved task boundaries, perform the reshape as part of the implementation and report it.
- If the reshape changes the product scope or creates an irreversible/outward action, stop with
  `BLOCKED` and a corrected plan.
- Implement the smallest correct architecture-compatible change, not the smallest textual diff.
- Do not leave half-ripples, compatibility fossils, or "later" migrations in active-dev mode.

## Path-Scoped Rule Support

The pre-code standard is reinforced by focused `${CLAUDE_PLUGIN_ROOT}/rules/` files:

- `active-dev.md`: no compatibility fossils or half-ripples in active-development mode.
- `architecture.md`: crate ownership, layering, and workspace boundary discipline.
- `types.md`: structural invariants, lifetimes, borrowing, and dispatch shape.
- `error-model.md`: typed error taxonomy and boundary diagnostics.
- `observability.md`: tracing, diagnostics, and invariant visibility.

## Eval Fixtures To Keep This Standard Honest

These scenarios ship under `${CLAUDE_PLUGIN_ROOT}/benchmarks/fixtures/` (each an
`input.rs` + `ground-truth.md` pair) and run via `/eval-agents` in **first-pass bar** mode:
the mapped agent passes only if it returns the expected `RESHAPE NEEDED` / `REDO-TO-BAR`
verdict on `input.rs` — a "looks fine, it compiles" response is a fail. They fail if agents
regress to junior behavior:

- `architecture/wrong-crate-helper`: helper/type must move to the owning crate.
- `active-dev/no-shim`: compatibility shim must be rejected when the workspace is unpublished.
- `workspace/full-ripple`: cross-crate change must update every affected member.
- `api/bool-and-stringly-types`: API must use domain types/newtypes/enums.
- `lifetimes/clone-to-appease-borrowck`: agent must restructure ownership/borrows before
  adding clones.
- `perf/hot-loop-allocation`: agent must identify and prove allocation-sensitive behavior.
- `modern-rust/stale-idiom`: agent must check current Rust docs before using an outdated
  pattern.
- `prior-art/use-existing-crate`: agent must find and reuse a mature workspace/ecosystem
  solution instead of hand-rolling.
- `unsafe/repr-and-uninit`: agent must catch the layout/UB hazard — wrong or missing `repr`,
  an aliasing or unaligned-reference fault, and `MaybeUninit` read before it is written.
- `reviewer/drop-and-dyn`: agent must flag `Drop` relied on for critical finalization (it is
  best-effort only), an RAII guard bound to a bare `_` that drops early, `Box<dyn Error>` leaking
  out of a library API instead of a typed error, and a change that breaks `dyn` compatibility.
- `modern-rust/hand-cas-and-cfgif`: agent must replace stale idioms — a hand-rolled
  compare-and-swap loop with atomic `update`/`try_update`, `cfg-if` with `cfg_select!`, `addr_of!`
  with `&raw const/mut`, and `lazy_static`/`static mut` with `LazyLock`/`OnceLock`.
- `api/non-exhaustive-and-fundamental`: agent must identify the semver hazards — a growable public
  enum/struct missing `#[non_exhaustive]`, a blanket impl on a fundamental type (`&T`, `Box<T>`,
  `Pin<P>`), and a `Result`-like return or guard type missing `#[must_use]`.
