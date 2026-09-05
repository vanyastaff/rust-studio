---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is `src/bin/sensor.rs`, firmware for a Cortex-M4 board (`thumbv7em-none-eabihf`). It flashes and runs, but the board resets 'randomly' under load. Review the ISR and the main loop; list findings with line numbers and end with a verdict.

```rust
//! crate: `acme-fw` — `src/bin/sensor.rs`, firmware for a Cortex-M4 board (`thumbv7em-none-eabihf`).
//! It flashes and runs. Every defect below is one `rules/embedded.md` or `rules/unsafe.md`
//! names; each is a reset or a corrupted reading waiting for the right interrupt timing.

#![no_std]
#![no_main]

use cortex_m_rt::{entry, exception};
use stm32f4xx_hal::pac::interrupt;

static mut SAMPLES: [u16; 64] = [0; 64];
static mut HEAD: usize = 0;
static mut READY: bool = false;

const ADC_DR: *mut u32 = 0x4001_204C as *mut u32;

#[interrupt]
fn ADC() {
    let raw = unsafe { *ADC_DR } as u16;
    unsafe {
        SAMPLES[HEAD] = raw;
        HEAD = (HEAD + 1) % SAMPLES.len();
        if HEAD == 0 {
            READY = true;
        }
    }
    let calibrated: alloc::vec::Vec<u16> = unsafe { SAMPLES.iter().map(|s| s / 4).collect() };
    let mean = calibrated.iter().map(|&s| s as u32).sum::<u32>() / calibrated.len() as u32;
    let _ = mean;
}

#[entry]
fn main() -> ! {
    loop {
        if unsafe { READY } {
            let sum: u32 = unsafe { SAMPLES.iter().map(|&s| s as u32).sum() };
            let avg = (sum / 64) as u16;
            report(avg).unwrap();
            unsafe { READY = false };
        }
    }
}

fn report(_avg: u16) -> Result<(), ()> {
    Ok(())
}

#[exception]
unsafe fn HardFault(_ef: &cortex_m_rt::ExceptionFrame) -> ! {
    loop {}
}

// Cargo.toml (excerpt):
//   [profile.release]
//   opt-level = 3
//   # panic = "unwind" (default)
```
