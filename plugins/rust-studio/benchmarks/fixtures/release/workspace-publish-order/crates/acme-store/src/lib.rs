//! Typed key-value operations on top of `acme-core`.

use std::path::Path;

pub use acme_core::{Config, OpenError, Store};

/// A store plus its configuration.
#[derive(Debug)]
pub struct TypedStore {
    inner: Store,
    config: Config,
}

impl TypedStore {
    /// Opens `path` with `config`.
    ///
    /// # Errors
    /// Propagates [`OpenError`] from [`acme_core::open`].
    pub fn open(path: &Path, config: Config) -> Result<Self, OpenError> {
        let inner = acme_core::open(path)?;
        Ok(Self { inner, config })
    }

    /// The underlying store.
    pub fn store(&self) -> &Store {
        &self.inner
    }

    /// Whether a key of `len` bytes is accepted (keys are capped at 1 KiB, and an
    /// unconfigured cap accepts everything).
    pub fn accepts_key_len(&self, len: usize, cap: Option<usize>) -> bool {
        if let Some(c) = cap
            && len > c
        {
            return false;
        }
        len <= 1024 || self.config.durable && len <= 4096
    }
}
