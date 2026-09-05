//! The codec contract.

use std::fmt;

/// A reversible byte transformation.
pub trait Codec {
    /// Short stable identifier used by the [`crate::Registry`].
    fn name(&self) -> &'static str;

    /// Encode `input`; never fails.
    fn encode(&self, input: &[u8]) -> Vec<u8>;

    /// Decode bytes previously produced by [`Codec::encode`].
    fn decode(&self, input: &[u8]) -> Result<Vec<u8>, DecodeError>;
}

/// A decode failure with the byte offset it was detected at.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodeError {
    pub offset: usize,
}

impl fmt::Display for DecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "malformed input at byte {}", self.offset)
    }
}

impl std::error::Error for DecodeError {}

/// Boxed codecs are codecs too, so a `Vec<Box<dyn Codec>>` can be handed to generic code.
impl<T: Codec + ?Sized> Codec for Box<T> {
    fn name(&self) -> &'static str {
        (**self).name()
    }
    fn encode(&self, input: &[u8]) -> Vec<u8> {
        (**self).encode(input)
    }
    fn decode(&self, input: &[u8]) -> Result<Vec<u8>, DecodeError> {
        (**self).decode(input)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Identity;
    impl Codec for Identity {
        fn name(&self) -> &'static str {
            "identity"
        }
        fn encode(&self, input: &[u8]) -> Vec<u8> {
            input.to_vec()
        }
        fn decode(&self, input: &[u8]) -> Result<Vec<u8>, DecodeError> {
            Ok(input.to_vec())
        }
    }

    #[test]
    fn boxed_codec_forwards() {
        let b: Box<dyn Codec> = Box::new(Identity);
        assert_eq!(b.encode(b"x"), b"x");
        assert_eq!(b.decode(b"x").unwrap(), b"x");
    }
}
