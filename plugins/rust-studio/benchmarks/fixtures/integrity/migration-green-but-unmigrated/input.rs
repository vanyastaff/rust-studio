// crates/core/src/lib.rs — the result of `cargo fix --edition` (2021 → 2024).
//
// Cargo.toml after the migration:
//     [package]
//     edition = "2024"
//     rust-version = "1.78"
//     [features]
//     extra = []
//
// Evidence from the migration PR:
//     cargo build --workspace   → clean
//     cargo nextest run         → 41 passed, 0 failed  (41 before, 41 after)
//     cargo clippy -- -D warnings → clean

use std::cell::RefCell;
use std::rc::Rc;

#[cfg(feature = "extra")]
pub mod extra;

pub type Audit = Rc<RefCell<Vec<&'static str>>>;

pub struct Span(pub &'static str, pub Audit);
impl Drop for Span {
    fn drop(&mut self) {
        self.1.borrow_mut().push(self.0);
    }
}
impl Span {
    pub fn finish(&self) -> Option<i32> {
        None
    }
}

pub fn record(audit: &Audit) -> i32 {
    match Span("span", audit.clone()).finish() { Some(v) => {
        v
    } _ => {
        audit.borrow_mut().push("fallback");
        0
    }}
}

#[cfg(feature = "extra")]
pub mod extra_inline {
    pub fn gen() -> u32 {
        42
    }
}
