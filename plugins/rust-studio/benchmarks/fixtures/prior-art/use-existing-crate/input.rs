//! crate: `acme-credential`. Hand-rolled primitives that mature crates (and a
//! sibling workspace crate) already own. No prior-art search was done — the
//! author reinvented both.

/// Hand-written hex encoder. The `hex` crate does this correctly and faster.
pub fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::new();
    for b in bytes {
        s.push(nibble(b >> 4));
        s.push(nibble(b & 0xf));
    }
    s
}

fn nibble(n: u8) -> char {
    if n < 10 { (b'0' + n) as char } else { (b'a' + n - 10) as char }
}

/// Bespoke exponential-backoff retry. The workspace ships `acme-resilience`
/// for exactly this (retry / backoff / jitter / typed errors); it was reinvented
/// inline with no jitter, no cap, and a unit error.
pub fn retry<F: Fn() -> Result<(), ()>>(f: F) -> Result<(), ()> {
    let mut delay_ms = 10u64;
    for _ in 0..5 {
        if f().is_ok() {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        delay_ms *= 2;
    }
    Err(())
}
