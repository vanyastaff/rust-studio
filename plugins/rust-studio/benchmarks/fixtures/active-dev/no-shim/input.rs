//! crate: `nebula-config` (unpublished — 0.0.x, NO external consumers yet).
//!
//! The loader was renamed, but instead of changing the (few, in-workspace)
//! callers, compatibility shims were kept "to be safe". In an unpublished
//! active-dev crate there is no API to preserve — the shims are pure debt.

pub struct Config {
    pub host: String,
    pub port: u16,
}

impl Config {
    fn from_path(_p: &str) -> Self {
        Config { host: "localhost".into(), port: 8080 }
    }
}

/// The intended API.
pub fn load_config(path: &str) -> Config {
    Config::from_path(path)
}

/// Old name kept as a deprecated alias. Nothing outside this workspace depends
/// on it (the crate is unpublished), yet it survives.
// TODO: migrate callers and remove this later.
#[deprecated(note = "use load_config")]
pub fn load(path: &str) -> Config {
    load_config(path)
}

/// The old return shape was a tuple; the new one is a struct. This adapter
/// flattens the struct back to the old tuple so stale call sites keep compiling
/// instead of being updated.
pub fn load_legacy(path: &str) -> (String, u16) {
    let c = load_config(path);
    (c.host, c.port)
}
