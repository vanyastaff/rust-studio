//! Wire header — has an `encode` method of its own that is NOT a `Codec` implementation.

/// Fixed 4-byte header preceding every frame on the wire.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Header {
    pub version: u8,
    pub flags: u8,
    pub len: u16,
}

impl Header {
    /// Serialises the header (inherent method; unrelated to the `Codec` trait).
    pub fn encode(&self) -> [u8; 4] {
        let [hi, lo] = self.len.to_be_bytes();
        [self.version, self.flags, hi, lo]
    }

    /// Parses a header (inherent method; unrelated to the `Codec` trait).
    pub fn decode(bytes: [u8; 4]) -> Self {
        Self { version: bytes[0], flags: bytes[1], len: u16::from_be_bytes([bytes[2], bytes[3]]) }
    }
}
