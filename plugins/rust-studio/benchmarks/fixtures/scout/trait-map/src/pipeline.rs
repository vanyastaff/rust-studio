//! Generic (static-dispatch) use of the codec contract.

use crate::codec::{Codec, DecodeError};

/// Encodes `input` with `codec`, prefixing the codec name so the receiver can pick a decoder.
pub fn frame<C: Codec>(codec: &C, input: &[u8]) -> Vec<u8> {
    let mut out = codec.name().as_bytes().to_vec();
    out.push(b':');
    out.extend(codec.encode(input));
    out
}

/// Inverse of [`frame`]: checks the name prefix, then decodes the remainder.
pub fn unframe<C: Codec>(codec: &C, framed: &[u8]) -> Result<Vec<u8>, DecodeError> {
    let prefix = codec.name().as_bytes();
    let Some(rest) = framed.strip_prefix(prefix) else {
        return Err(DecodeError { offset: 0 });
    };
    let Some(rest) = rest.strip_prefix(b":") else {
        return Err(DecodeError { offset: prefix.len() });
    };
    codec.decode(rest)
}

/// Round-trips `input` through `codec`, returning whether the bytes survived.
pub fn survives(codec: &dyn Codec, input: &[u8]) -> bool {
    codec.decode(&codec.encode(input)).is_ok_and(|back| back == input)
}
