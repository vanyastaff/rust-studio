//! crate: `acme-runtime`. Pre-2021 idioms a current-edition maintainer flags.
//! Compiles, but reaches for unsafe `static mut` and verbose forms the modern
//! std/edition replaced.

use std::sync::Once;

static INIT: Once = Once::new();
static mut CONFIG: Option<String> = None;

/// Manual `Once` + `static mut` (unsafe) instead of `OnceLock` / `LazyLock`.
pub fn config() -> String {
    unsafe {
        INIT.call_once(|| {
            CONFIG = Some("default".to_string());
        });
        CONFIG.clone().unwrap()
    }
}

/// Verbose `match` where `let ... else` is the current idiom.
pub fn first_id(items: &[u32]) -> u32 {
    let id = match items.first() {
        Some(x) => *x,
        None => return 0,
    };
    id
}

/// Identity-map busywork before `collect`.
pub fn names(v: &[String]) -> Vec<String> {
    v.iter().map(|x| x.clone()).map(|x| x).collect()
}
