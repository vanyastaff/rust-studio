use crate::limits::{validate_len, MAX_PART};
use crate::Error;

/// Split a multipart payload into its parts.
pub fn parse_parts(raw: &[u8], boundary: &[u8]) -> Result<Vec<Vec<u8>>, Error> {
    validate_len(raw, MAX_PART)?;
    let mut out = Vec::new();
    for chunk in raw.split(|b| boundary.first() == Some(b)) {
        validate_len(chunk, MAX_PART)?;
        out.push(chunk.to_vec());
    }
    Ok(out)
}
