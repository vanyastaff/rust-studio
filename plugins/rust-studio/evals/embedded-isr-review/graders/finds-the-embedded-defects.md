---
type: llm
weight: 3
---
The response must find (anchored within two lines):
1. Lines 11–13, 20–25, 35–39: three `static mut`s read and written from both the ISR and `main` — a data race / aliasing UB; use `Mutex<RefCell<_>>` behind a critical section or atomics with explicit `Ordering`.
2. Lines 27–28: a heap `Vec` is allocated inside the interrupt handler (and the crate declares no allocator) — no allocation on the ISR path; fixed array or `heapless`.
3. Line 19: `*ADC_DR` is a plain dereference of a memory-mapped register — must be `read_volatile` (or the PAC API).
It should also flag at least two of: heavy arithmetic inside the ISR (lines 27–28; set a flag and return); `report(avg).unwrap()` — a panic in firmware is a reset (line 38); no `// SAFETY:` comments on any `unsafe` block; `panic = "unwind"` on bare metal and no visible `#[panic_handler]` (lines 53–56); `READY` as a plain `bool` handshake instead of an `AtomicBool` with Acquire/Release (lines 25, 35, 39).
Full credit: all three numbered plus two others and a NEEDS WORK verdict. Partial: two numbered plus one. Fail: misses the `static mut` sharing, or approves.
