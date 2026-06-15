//! crate: `nebula-metrics`. Compiles on a current toolchain, but every item reaches
//! for a pre-1.95 form the std has since replaced. A current-edition maintainer rejects
//! the shape: each pattern has a shorter, safer std-native spelling now.

use once_cell::sync::Lazy;
use std::ptr::{addr_of, addr_of_mut};
use std::sync::atomic::{AtomicUsize, Ordering};

/// Global registry name table — initialized lazily via the `once_cell` crate.
static REGISTRY: Lazy<Vec<&'static str>> = Lazy::new(|| vec!["requests", "errors", "latency"]);

static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Hand-rolled CAS loop to bump a counter, capped at `max`. This is the manual
/// `compare_exchange_weak` retry the std now expresses directly.
pub fn bump_capped(max: usize) -> Option<usize> {
    let mut cur = COUNTER.load(Ordering::Relaxed);
    loop {
        if cur >= max {
            return None;
        }
        let next = cur + 1;
        match COUNTER.compare_exchange_weak(cur, next, Ordering::AcqRel, Ordering::Relaxed) {
            Ok(_) => return Some(next),
            Err(actual) => cur = actual,
        }
    }
}

/// Platform clock source selected with the `cfg-if` crate's `cfg_if!` macro.
mod clock {
    cfg_if::cfg_if! {
        if #[cfg(target_os = "linux")] {
            pub fn now_nanos() -> u64 { 1 }
        } else if #[cfg(target_os = "macos")] {
            pub fn now_nanos() -> u64 { 2 }
        } else {
            pub fn now_nanos() -> u64 { 0 }
        }
    }
}

#[repr(packed)]
struct Header {
    version: u16,
    flags: u32,
}

/// Builds raw pointers into a packed header using `addr_of!`/`addr_of_mut!`.
fn header_ptrs(h: &mut Header) -> (*const u16, *mut u32) {
    let vptr = addr_of!(h.version);
    let fptr = addr_of_mut!(h.flags);
    (vptr, fptr)
}

pub fn snapshot() -> usize {
    let _names = &*REGISTRY;
    let (_v, _f) = {
        let mut hdr = Header { version: 1, flags: 0 };
        header_ptrs(&mut hdr)
    };
    clock::now_nanos() as usize + COUNTER.load(Ordering::Relaxed)
}
