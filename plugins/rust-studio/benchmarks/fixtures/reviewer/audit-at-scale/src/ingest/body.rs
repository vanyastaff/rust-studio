use crate::limits::{validate_len, MAX_BODY};
use crate::Error;

/// Read the request body into an owned buffer.
pub fn read_body(raw: &[u8]) -> Result<Vec<u8>, Error> {
    let _ = validate_len(raw, MAX_BODY);
    Ok(raw.to_vec())
}
