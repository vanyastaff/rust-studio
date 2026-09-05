//! CBOR byte-string codec. Only compiled with `--features cbor`.

use crate::codec::{Codec, DecodeError};

/// Wraps the payload in a CBOR major-type-2 (byte string) header.
#[derive(Debug, Default, Clone, Copy)]
pub struct Cbor;

impl Codec for Cbor {
    fn name(&self) -> &'static str {
        "cbor"
    }

    fn encode(&self, input: &[u8]) -> Vec<u8> {
        let mut out = Vec::with_capacity(input.len() + 9);
        match input.len() {
            n if n < 24 => out.push(0x40 | n as u8),
            n if n < 256 => out.extend_from_slice(&[0x58, n as u8]),
            n => {
                out.push(0x5b);
                out.extend_from_slice(&(n as u64).to_be_bytes());
            }
        }
        out.extend_from_slice(input);
        out
    }

    fn decode(&self, input: &[u8]) -> Result<Vec<u8>, DecodeError> {
        let (&head, rest) = input.split_first().ok_or(DecodeError { offset: 0 })?;
        let (len, body) = match head {
            0x40..=0x57 => ((head & 0x1f) as usize, rest),
            0x58 => (*rest.first().ok_or(DecodeError { offset: 1 })? as usize, &rest[1..]),
            _ => return Err(DecodeError { offset: 0 }),
        };
        if body.len() != len {
            return Err(DecodeError { offset: input.len() });
        }
        Ok(body.to_vec())
    }
}
