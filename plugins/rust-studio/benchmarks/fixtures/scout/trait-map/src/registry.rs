//! Runtime codec selection by name.

use crate::codec::{Codec, DecodeError};

/// Owns a set of codecs and dispatches by [`Codec::name`].
#[derive(Default)]
pub struct Registry {
    codecs: Vec<Box<dyn Codec>>,
}

impl Registry {
    /// Registers `codec`; later registrations with the same name shadow earlier ones.
    pub fn register(&mut self, codec: Box<dyn Codec>) -> &mut Self {
        self.codecs.push(codec);
        self
    }

    /// The codec registered under `name`, if any (last registration wins).
    pub fn get(&self, name: &str) -> Option<&dyn Codec> {
        self.codecs.iter().rev().find(|c| c.name() == name).map(|c| &**c)
    }

    /// Encodes with the named codec. Returns `None` when no codec has that name.
    pub fn encode_with(&self, name: &str, input: &[u8]) -> Option<Vec<u8>> {
        self.get(name).map(|c| c.encode(input))
    }

    /// Decodes with the named codec. Returns `None` when no codec has that name.
    pub fn decode_with(&self, name: &str, input: &[u8]) -> Option<Result<Vec<u8>, DecodeError>> {
        self.get(name).map(|c| c.decode(input))
    }

    /// Names in registration order.
    pub fn names(&self) -> impl Iterator<Item = &'static str> + '_ {
        self.codecs.iter().map(|c| c.name())
    }
}

/// The codecs every binary ships with.
pub fn default_registry() -> Registry {
    let mut r = Registry::default();
    r.register(Box::new(crate::json::Json)).register(Box::new(crate::compact::Compact8));
    #[cfg(feature = "cbor")]
    r.register(Box::new(crate::cbor::Cbor));
    r
}
