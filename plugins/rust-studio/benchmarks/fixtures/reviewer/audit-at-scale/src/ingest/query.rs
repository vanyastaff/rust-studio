use crate::limits::{validate_len, MAX_QUERY};
use crate::Error;

/// Parse the query string into key/value pairs.
pub fn parse_query(raw: &[u8]) -> Result<Vec<(String, String)>, Error> {
    validate_len(raw, MAX_QUERY)?;
    let text = std::str::from_utf8(raw).map_err(|_| Error::Malformed)?;
    Ok(text
        .split('&')
        .filter_map(|p| p.split_once('='))
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect())
}
