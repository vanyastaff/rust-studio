//! `acme-codec` — pluggable byte codecs behind one trait.
//!
//! A [`Codec`] turns bytes into bytes and back. Concrete codecs live in their own modules;
//! the [`Registry`] picks one by name at runtime.

pub mod codec;
pub mod compact;
pub mod json;
pub mod pipeline;
mod registry;
pub mod wire;

#[cfg(feature = "cbor")]
pub mod cbor;

pub use codec::Codec;
pub use registry::Registry;
pub use registry::default_registry;

/// Comma-separated codec names for `--help` text.
pub fn registry_names_for_help() -> String {
    default_registry().names().collect::<Vec<_>>().join(", ")
}
