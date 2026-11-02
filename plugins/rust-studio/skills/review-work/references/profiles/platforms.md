# FFI, embedded and WebAssembly

Load the relevant section for the target and add `systems.md` for SAFETY-GATE or `tooling.md`
for BUILD-GATE. Platform build success alone does not prove runtime behavior.

## C boundary

Read `references/ffi.md` and `references/build-scripts.md`.
Map upstream headers and choose handwritten/generated/hybrid bindings by the interface.

- Match calling conventions, signatures, field order, alignment and padding. repr(Rust)
  has no stable C layout; use repr(C)/transparent and passing bindgen layout tests.
  Packed fields require raw/unaligned accesses. Arbitrary C integers cannot enter a Rust
  enum with undeclared discriminants: use a transparent integer wrapper with constants.
- State allocation/free ownership, nullability and validity duration for every pointer.
  Opaque handles are explicitly opaque in generated headers and keep fields private.
  Pair new/open with close/free; Box::into_raw/from_raw reclaim exactly once. Iteration
  stores a cursor/index in the owner, not a borrowed iterator extended by transmute.
- CStr::from_ptr requires a valid nonnull NUL-terminated input. Bind CString ownership
  while any pointer is live/retained; a temporary's as_ptr dangles after its statement.
  Return flat integer error codes with out-parameters; Rust-owned strings need an explicit
  pointer/length transfer and matching free function, not a String ABI.
- No unwind may escape an ordinary extern C boundary: establish panic-abort or a
  catch_unwind boundary with defined error/abort behavior; account for foreign unwinding.
  Verify nullable niche representations only where guaranteed.
- Native probes (pkg-config/cmake/cc), link flags and DEP_* metadata are target-aware.
  Bindgen/cbindgen output is reproducible; generated headers compile as C and C++ and
  remain synchronized with source. Verify target builds, layout tests and project lint gate.

## Embedded/no_std

Read `references/embedded.md`. Pin the target, HAL version, critical-section
implementation, linker/memory map and allocation policy. Check no_std/no_main startup,
vector tables/NVIC, entry point, panic handler and no-unwind policy. Use core/alloc according
to that policy; detect hidden format!/Box/Vec/String dependencies. Budget statically sized
heapless collections and const generics. Keep ISRs short, MMIO through PAC/volatile, and
thread/ISR shared peripherals under critical sections or appropriate atomics. Prove DMA
buffer aliasing/lifetime and register-access invariants. Verify target no-default-feature
checks and cargo size/objdump output; describe timer-driven versus busy-wait timing behavior.

## WebAssembly

Read `references/wasm.md`. Identify the exact supported target and runtime
(browser/Node/WASI); check current toolchain target names and installed getrandom backend
configuration rather than assuming a version's feature names. Audit thread/filesystem/socket
and OS RNG assumptions according to that environment. wasm-bindgen exports accept compatible
types and explicit Result/JsValue errors; hostile JS input is validated and opaque panics
are avoided. Check panic policy/hook, opt-level/LTO/codegen-units/strip and allocator costs.
Measure wasm-opt before/after and twiggy contributors against the size budget. Run target
builds and bindgen tests in the intended runtime, such as headless browser wasm-pack tests.
