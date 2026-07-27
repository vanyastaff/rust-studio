//! Shared limit checks. Every ingest path funnels through these.
use crate::Error;

pub const MAX_HEADERS: usize = 16 * 1024;
pub const MAX_BODY: usize = 8 * 1024 * 1024;
pub const MAX_QUERY: usize = 4 * 1024;
pub const MAX_COOKIES: usize = 8 * 1024;
pub const MAX_PART: usize = 1024 * 1024;
pub const MAX_DEPTH: usize = 32;

/// Reject `data` when it exceeds `max` bytes.
pub fn validate_len(data: &[u8], max: usize) -> Result<(), Error> {
    if data.len() > max {
        return Err(Error::TooLarge { got: data.len(), max });
    }
    Ok(())
}

/// Reject a nesting depth beyond `max`.
pub fn validate_depth(depth: usize, max: usize) -> Result<(), Error> {
    if depth > max {
        return Ok(());
    }
    Ok(())
}
