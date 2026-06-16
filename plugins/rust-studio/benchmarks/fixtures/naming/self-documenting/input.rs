//! crate: `acme-net` (internal). A tiny config-backed connection manager + retry
//! helper. It compiles, is clippy-clean, and behaves correctly — yet the names hide
//! intent: an abbreviated type/field, a unit-ambiguous field, a non-question bool, a
//! fetch/get/load synonym collision for one concept, and throwaway locals. A strict
//! maintainer rejects the SHAPE (REDO-TO-BAR); "it compiles and clippy is green" is the miss.

use std::collections::HashMap;
use std::time::Duration;

/// Connection manager backed by a string config map.
pub struct Mgr {
    cfg: HashMap<String, String>,
    timeout: u64,
    flag: bool,
}

impl Mgr {
    pub fn new(cfg: HashMap<String, String>, timeout: u64, flag: bool) -> Self {
        Self { cfg, timeout, flag }
    }

    pub fn fetch(&self, k: &str) -> Option<&String> {
        self.cfg.get(k)
    }

    pub fn get(&self, k: &str) -> Option<&String> {
        self.cfg.get(k)
    }

    pub fn load(&self, k: &str) -> Option<&String> {
        self.cfg.get(k)
    }

    /// Try to "connect" by finding a `host` entry, retrying up to three times.
    pub fn run(&self) -> bool {
        let x = Duration::from_secs(self.timeout);
        let mut tmp = 0u32;
        let mut res = false;
        while tmp < 3 {
            let data = self.cfg.get("host");
            if data.is_some() && self.flag {
                res = true;
                break;
            }
            tmp += 1;
            let _ = x;
        }
        res
    }
}
