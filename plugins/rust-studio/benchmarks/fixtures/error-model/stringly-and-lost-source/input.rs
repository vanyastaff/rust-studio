//! crate: `acme-store` (a PUBLISHED library) — `src/error.rs` + the functions that use it.
//! Everything compiles, the tests pass, and every error shape here is one `rules/error-model.md`
//! rejects.

use std::error::Error;
use std::fmt;

/// The crate's public error type.
#[derive(Debug)]
pub struct StoreError(pub String);

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl Error for StoreError {}

pub struct Credentials {
    pub user: String,
    pub api_token: String,
}

impl fmt::Debug for Credentials {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Credentials {{ user: {}, api_token: {} }}", self.user, self.api_token)
    }
}

/// Open the store at `path`.
pub fn open(path: &str) -> Result<Store, Box<dyn Error>> {
    let raw = std::fs::read_to_string(path)?;
    let cfg: Config = toml::from_str(&raw).map_err(|e| StoreError(e.to_string()))?;
    Ok(Store { cfg })
}

/// Background flush: the error crosses a task boundary.
pub fn spawn_flush(store: Store) -> tokio::task::JoinHandle<Result<(), Box<dyn Error>>> {
    tokio::spawn(async move { store.flush().await })
}

pub struct Store {
    cfg: Config,
}

pub struct Config {
    pub creds: Credentials,
}

impl Store {
    pub async fn flush(&self) -> Result<(), Box<dyn Error>> {
        Err(Box::new(StoreError(format!("flush failed for {:?}", self.cfg.creds))))
    }

    /// Callers use this to decide whether to retry.
    pub fn is_retryable(err: &StoreError) -> bool {
        err.0.contains("timed out") || err.0.contains("connection reset")
    }

    pub fn put(&self, key: String, value: Vec<u8>) -> Result<(), StoreError> {
        if key.is_empty() {
            return Err(StoreError("empty key".into()));
        }
        let _ = value;
        Ok(())
    }
}

/// Composition root for the bundled CLI (`src/bin/store.rs` calls this).
pub fn bootstrap(path: &str) -> Store {
    open(path).expect("config must be valid")
}
