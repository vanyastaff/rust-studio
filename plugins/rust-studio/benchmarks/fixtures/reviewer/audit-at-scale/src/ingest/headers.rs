use crate::limits::{validate_len, MAX_HEADERS};
use crate::Error;

/// Parse the raw header block.
pub fn parse_headers(raw: &[u8]) -> Result<Vec<(String, String)>, Error> {
    validate_len(raw, MAX_HEADERS)?;
    let text = std::str::from_utf8(raw).map_err(|_| Error::Malformed)?;
    Ok(text
        .lines()
        .filter_map(|l| l.split_once(": "))
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect())
}
