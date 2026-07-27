use crate::limits::{validate_len, MAX_BODY};
use crate::Error;

/// Decode UTF-8 text after bounding its size.
pub fn decode(raw: &[u8]) -> Result<String, Error> {
    validate_len(raw, MAX_BODY)?;
    std::str::from_utf8(raw)
        .map(str::to_owned)
        .map_err(|_| Error::Malformed)
}
