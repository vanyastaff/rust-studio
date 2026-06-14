//! crate: `nebula-client` (public API surface). Connection + apply options
//! encoded as bool flags and stringly params. Compiles fine; the call sites are
//! unreadable and illegal combinations are representable.

/// Two adjacent bools are indistinguishable at the call site: `connect(a, true, false, "rw")`.
pub fn connect(addr: &str, secure: bool, verify_cert: bool, mode: &str) -> Connection {
    let _ = (secure, verify_cert);
    // `mode` is a stringly protocol: "ro" | "rw" | "admin", validated nowhere.
    Connection { addr: addr.to_string(), mode: mode.to_string() }
}

/// `level` is a stringly enum; `force` + `dry_run` is a bool pair whose illegal
/// combination (force && dry_run) the type does not forbid.
pub fn apply(level: &str, force: bool, dry_run: bool) -> Result<(), String> {
    if level != "low" && level != "high" {
        return Err(format!("bad level: {level}"));
    }
    let _ = (force, dry_run);
    Ok(())
}

pub struct Connection {
    pub addr: String,
    pub mode: String,
}
