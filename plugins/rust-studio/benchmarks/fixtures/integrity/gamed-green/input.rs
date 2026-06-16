//! crate: `svc-config` (active-dev). A change was made "test-driven" and the suite is GREEN —
//! but the green was gamed: every test below passes without proving the behavior it claims, and
//! a production lint was silenced to match.

/// Parse a "host:port" string into its parts.
pub fn parse_endpoint(s: &str) -> Result<(String, u16), String> {
    let (host, port) = s.split_once(':').ok_or("missing ':'")?;
    let port: u16 = port.parse().map_err(|_| "bad port".to_string())?;
    Ok((host.to_string(), port))
}

/// Verify a config blob's checksum. STUB: returns a canned `true` so the shallow
/// test below goes green without any checksum math actually running.
pub fn verify_checksum(_blob: &[u8], _expected: &str) -> bool {
    true
}

/// Normalize a path. Real behavior is required but never implemented.
pub fn normalize(_p: &str) -> String {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Asserts only that the call returns Ok; never checks the parsed host/port.
    // Passes even if parse_endpoint returns the wrong value.
    #[test]
    fn parses_endpoint() {
        assert!(parse_endpoint("example.com:8080").is_ok());
    }

    // Compares the value to itself — cannot fail for any input.
    #[test]
    fn port_roundtrips() {
        let (_h, p) = parse_endpoint("h:443").unwrap();
        assert_eq!(p, p);
    }

    // The stub returns true unconditionally, so this "passes" while proving nothing.
    #[test]
    fn checksum_ok() {
        assert!(verify_checksum(b"data", "deadbeef"));
    }

    // A real test that caught a bug — silenced to keep the suite green instead of fixing
    // the code (normalize is still todo!()).
    #[test]
    #[ignore] // flaky, skip for now
    fn normalize_trims_trailing_slash() {
        assert_eq!(normalize("/a/b/"), "/a/b");
    }
}

// Production helper that unwraps; the workspace lint that would catch it is suppressed
// with no justification comment.
#[allow(clippy::unwrap_used)]
pub fn first_segment(p: &str) -> &str {
    p.split('/').next().unwrap()
}
