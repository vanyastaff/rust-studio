---
name: embedded
paths: "**/firmware/**,**/embedded/**,**/bsp/**,**/hal/**,**/*-rt/**,**/boards/**,**/src/bin/**"
description: Rust no_std / embedded / bare-metal standards
---

# Embedded & no_std Standards

Applies to `no_std` / bare-metal firmware, HAL/BSP crates, and interrupt-driven code.
Owned by `embedded-specialist`. Pairs with `unsafe.md` (MMIO/interrupts are unsafe) and
`perf.md` (allocation discipline).

## no_std discipline
- `#![no_std]` (and `#![no_main]` for the binary). Use `core` and, only when an allocator
  exists, `alloc` — never an accidental `std` re-export. Audit dependencies for default
  `std` features; build with `default-features = false`.
- Provide the required lang items: a `#[panic_handler]` and, on bare metal, the reset
  entry (`#[cortex_m_rt::entry]` / `#[entry]`).

## Memory & allocation
- Prefer static allocation: fixed-size buffers, `heapless::{Vec, String, spsc::Queue}`,
  const generics for capacity. Avoid a heap unless the target genuinely needs one.
- No `unwrap`/`expect`/`panic!` on a hot or interrupt path — a panic in firmware is a
  reset. Handle errors; reserve panics for truly unreachable invariants.
- Hard real-time / hot ISR paths: no dynamic allocation at all.

## Concurrency & interrupts
- Shared state between an ISR and main runs through a critical section
  (`critical-section` crate) or lock-free `AtomicXxx` with an explicit `Ordering` — never
  a bare `static mut` (that's instant UB on aliasing). Prefer `Mutex<RefCell<T>>` behind a
  critical section, or an RTIC resource, over hand-rolled `static mut`.
- Keep ISRs short: set a flag / push to a queue and return; do the work in the main loop.

## MMIO & unsafe
- Register access is `unsafe` and needs a `// SAFETY:` note (see `unsafe.md`). Prefer a
  PAC/`svd2rust` or `embedded-hal` abstraction over raw pointer writes; use
  `read_volatile`/`write_volatile` for any raw MMIO, never a plain dereference.
- Target `embedded-hal` traits so drivers are portable across HALs.

## Build
- Set `panic = "abort"` (no unwinding on bare metal). Provide a `memory.x`/linker script
  and the correct target triple (e.g. `thumbv7em-none-eabihf`); pin it in
  `.cargo/config.toml`.
- Size matters: `opt-level = "z"`/`"s"`, `lto = true`, `codegen-units = 1`; check with
  `cargo size`/`cargo bloat`.
