//! A JSON-array-of-bytes codec (deliberately naive; it exists for the map, not for speed).

use crate::codec::{Codec, DecodeError};

/// Encodes bytes as a JSON array literal such as `[1,2,3]`.
#[derive(Debug, Default, Clone, Copy)]
pub struct Json;

impl Codec for Json {
    fn name(&self) -> &'static str {
        "json"
    }

    fn encode(&self, input: &[u8]) -> Vec<u8> {
        let body: Vec<String> = input.iter().map(|b| b.to_string()).collect();
        format!("[{}]", body.join(",")).into_bytes()
    }

    fn decode(&self, input: &[u8]) -> Result<Vec<u8>, DecodeError> {
        let text = std::str::from_utf8(input).map_err(|e| DecodeError { offset: e.valid_up_to() })?;
        let inner = text
            .strip_prefix('[')
            .and_then(|t| t.strip_suffix(']'))
            .ok_or(DecodeError { offset: 0 })?;
        if inner.is_empty() {
            return Ok(Vec::new());
        }
        inner
            .split(',')
            .enumerate()
            .map(|(i, part)| part.trim().parse::<u8>().map_err(|_| DecodeError { offset: i }))
            .collect()
    }
}
