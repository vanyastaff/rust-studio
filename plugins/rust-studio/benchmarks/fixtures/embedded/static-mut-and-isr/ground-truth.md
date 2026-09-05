# Ground truth — embedded/static-mut-and-isr (agent: `embedded-specialist`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"This firmware flashes and runs, and the board resets 'randomly' under load. Review the ISR and main loop. List every finding with file:line and severity, then give a verdict."* Every defect is one `rules/embedded.md` / `rules/unsafe.md` names.

| id   | line   | type                        | severity | defect |
|------|--------|-----------------------------|----------|--------|
| GT-1 | 11–13, 20–25, 35–39 | `static mut` SHARED WITH AN ISR | 🔴 | Three `static mut`s read and written from both the interrupt and `main` — a data race and aliasing UB (edition 2024 makes every access `unsafe`, and it is still UB). `Mutex<RefCell<_>>` behind a `critical-section`, or `AtomicBool`/`AtomicUsize` with explicit `Ordering` for the flags. |
| GT-2 | 27–28  | HEAP ALLOCATION IN AN ISR   | 🔴 | `alloc::vec::Vec` collected inside the interrupt — allocation on the hot ISR path (and `alloc` in a crate that declares no allocator). Compute in `main`, or use a fixed `[u16; 64]` / `heapless::Vec`. |
| GT-3 | 19     | PLAIN DEREF FOR MMIO        | 🔴 | `*ADC_DR` is an ordinary volatile-less read of a memory-mapped register — the compiler may elide or reorder it. `core::ptr::read_volatile`, or the PAC's register API. |
| GT-4 | 27–28  | WORK IN THE ISR             | 🟠 | Calibrating and averaging 64 samples inside the interrupt lengthens it past the next ADC event. Set the flag and return; do the arithmetic in the main loop. |
| GT-5 | 38     | `unwrap()` ON THE HOT PATH  | 🟠 | `report(avg).unwrap()` — a panic in firmware is a reset. Handle the error. |
| GT-6 | 19–29  | NO `// SAFETY:` COMMENTS    | 🟠 | Five `unsafe` blocks, zero stated invariants. |
| GT-7 | 53–56  | `panic = "unwind"` ON BARE METAL | 🟠 | The profile leaves unwinding on; bare metal needs `panic = "abort"`, and there is no `#[panic_handler]` visible (`panic-halt`/`panic-probe`). |
| GT-8 | 25, 35, 39 | NON-ATOMIC HANDSHAKE     | 🟡 | `READY` is a plain `bool` used as a flag between contexts with no ordering guarantee; even without the race, the compiler may hoist the read in `main`'s loop. An `AtomicBool` with `Acquire`/`Release`. |

Pass = GT-1, GT-2, GT-3 and at least two of the others, with a `NEEDS WORK` verdict withholding
the SAFETY-GATE.
