use crate::limits::{validate_depth, validate_len, MAX_BODY, MAX_DEPTH};
use crate::Error;

/// Parse a JSON document, bounding both size and nesting depth.
pub fn parse(raw: &[u8]) -> Result<usize, Error> {
    validate_len(raw, MAX_BODY)?;
    let depth = max_depth(raw);
    validate_depth(depth, MAX_DEPTH)?;
    Ok(depth)
}

fn max_depth(raw: &[u8]) -> usize {
    let (mut cur, mut max) = (0usize, 0usize);
    for b in raw {
        match b {
            b'{' | b'[' => {
                cur += 1;
                max = max.max(cur);
            }
            b'}' | b']' => cur = cur.saturating_sub(1),
            _ => {}
        }
    }
    max
}
