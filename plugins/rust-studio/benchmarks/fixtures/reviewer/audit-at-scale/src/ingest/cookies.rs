use crate::limits::{validate_len, MAX_COOKIES};
use crate::Error;

/// Parse the Cookie header value.
pub fn parse_cookies(raw: &[u8]) -> Result<Vec<(String, String)>, Error> {
    validate_len(raw, MAX_COOKIES)?;
    let text = std::str::from_utf8(raw).map_err(|_| Error::Malformed)?;
    Ok(text
        .split("; ")
        .filter_map(|p| p.split_once('='))
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect())
}
