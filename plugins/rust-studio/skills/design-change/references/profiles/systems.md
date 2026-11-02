# Memory safety and concurrency

Use for unsafe, atomics, shared state, layout and confinement claims. Read
`references/unsafe.md`, `references/types.md` and
`references/core.md`; add `platforms.md` for FFI/embedded/Wasm and
`performance.md` for PERF-GATE.

## Soundness inventory

Inventory every unsafe block, fn, impl and trait in scope before judging sites. Trace callers
and reachable paths. Each block's `// SAFETY:` states why its preconditions hold; each unsafe
function documents `# Safety`; retain the project's unsafe-operation lint discipline.

- Check aliasing, provenance, dangling pointers, initialization, size/alignment, padding,
  data races, immutable-byte mutation, ABI and unwinding. Shared mutation requires UnsafeCell;
  a shared reference cannot simply become exclusive. Const-evaluated pointer-to-integer
  transformations require particular provenance scrutiny.
- Check per-type validity: bool values, Unicode scalar chars, enum discriminants, nonzero
  and nonnull values, fn pointers, references/Box and the uninhabited type. Private fields
  do not relax validity. Uninitialized scalar reads are invalid; account for union/padding rules.
- Packed/unaligned/uninitialized places use raw pointer formation, not an intermediate
  reference; use unaligned accesses where required. `MaybeUninit` is written before
  `assume_init`; zeroed memory is valid only when that type permits the bit pattern.
- Owning NonNull containers need correct drop-check/variance markers. Pinning invariants,
  PhantomData and PhantomPinned cannot be removed merely to satisfy bounds.
- Validate layout promises, integer-backed C status values, nullable niches and no-unwind
  boundaries with the platform profile. Reduce avoidable unsafe behind a safe contract.

## Shared state checks

- For every manual Send/Sync impl prove the underlying transfer/sharing contract. Required
  thread confinement uses intentional marker fields and a compile-time negative assertion
  or compile_fail test; retiring unsafe impls alone does not pin the claim.
- Name happens-before edges for each atomic ordering. Relaxed needs proof that no publication
  synchronization is needed; SeqCst does not replace a correctness argument. Prefer supported
  atomic update helpers over bespoke retry loops when their semantics fit the project's MSRV.
- Establish one lock order, a poisoning strategy and justified scope. Compare ownership,
  scoped threads, channels, actor-owned state or sharding with an Arc/Mutex state bus.
  Init-once globals use OnceLock/LazyLock; counters use atomics; mutable globals need safe
  synchronization instead of static mut. Check hot cache lines for false sharing/padding.
- Model hand-rolled atomic/lock-free interleavings with loom, recording the preemption bounds.
  Run Miri over all relevant unsafe tests; document unsupported targets/FFI and uncovered paths.

## SAFETY-GATE

All inventoried sites have sound invariants and documented callers, valid layout and evidence
from Miri/loom where applicable. Required safety review is independent of the implementation;
missing proof or unavailable required checks withholds the gate. UB CI jobs that are merely
advisory do not protect merging. Use `references/templates/safety-review.md`
to report site coverage, findings, commands and limits. Avoidable unsafe introduced by a
change is a shape finding; pre-existing minimization opportunities outside scope are advisory.
