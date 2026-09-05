//! Core types for the Acme key-value store.

use std::path::Path;

/// An open store handle.
#[derive(Debug)]
pub struct Store {
    root: std::path::PathBuf,
}

/// Why [`open`] failed.
#[derive(Debug)]
pub enum OpenError {
    /// The directory does not exist.
    Missing(std::path::PathBuf),
    /// The directory exists but is not readable.
    Unreadable(std::io::Error),
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Missing(p) => write!(f, "store directory {} does not exist", p.display()),
            Self::Unreadable(e) => write!(f, "store directory is unreadable: {e}"),
        }
    }
}

impl std::error::Error for OpenError {}

/// Opens the store rooted at `path`.
///
/// # Errors
/// Returns [`OpenError::Missing`] when `path` does not exist and
/// [`OpenError::Unreadable`] when it cannot be read.
pub fn open(path: &Path) -> Result<Store, OpenError> {
    if !path.exists() {
        return Err(OpenError::Missing(path.to_path_buf()));
    }
    std::fs::read_dir(path).map_err(OpenError::Unreadable)?;
    Ok(Store { root: path.to_path_buf() })
}

impl Store {
    /// The directory this store lives in.
    pub fn root(&self) -> &Path {
        &self.root
    }
}

/// Store configuration.
#[derive(Debug, Clone, Default)]
pub struct Config {
    /// Whether writes are fsync'd before returning.
    pub durable: bool,
}
