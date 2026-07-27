use crate::ingest::{body, headers};
use crate::Error;

/// Handle one framed request off the wire.
pub fn handle_frame(head: &[u8], payload: &[u8]) -> Result<usize, Error> {
    let fields = headers::parse_headers(head)?;
    let bytes = body::read_body(payload)?;
    Ok(fields.len() + bytes.len())
}
