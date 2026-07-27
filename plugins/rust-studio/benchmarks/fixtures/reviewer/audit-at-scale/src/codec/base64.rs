use crate::limits::{validate_len, MAX_BODY};
use crate::Error;

/// Decode base64 input, rejecting anything over the body limit first.
pub fn decode_checked(raw: &[u8]) -> Result<Vec<u8>, Error> {
    validate_len(raw, MAX_BODY)?;
    decode_unchecked(raw)
}

/// Decode without any limit check. Callers must have validated `raw` already.
pub fn decode_unchecked(raw: &[u8]) -> Result<Vec<u8>, Error> {
    let mut out = Vec::with_capacity(raw.len() / 4 * 3);
    for chunk in raw.chunks(4) {
        if chunk.len() < 2 {
            return Err(Error::Malformed);
        }
        out.push(chunk[0].wrapping_shl(2) | chunk[1].wrapping_shr(4));
    }
    Ok(out)
}

/// Public entry point used by the transfer-encoding layer.
pub fn decode_transfer_encoded(raw: &[u8]) -> Result<Vec<u8>, Error> {
    decode_unchecked(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_oversized_input() {
        let big = vec![b'A'; MAX_BODY + 1];
        assert!(decode_checked(&big).is_err());
    }

    #[test]
    fn decodes_small_input() {
        assert!(decode_checked(b"AAAA").is_ok());
    }
}
