//! crate: `acme-store` 1.x (published public API surface). A small key/value
//! store façade. Compiles fine; the shape pins this crate's semver in four ways
//! that will hurt at the next release.

use std::collections::HashMap;

/// Errors returned across the public boundary. New failure modes are clearly
/// coming (network, auth, quota) as the store grows.
pub enum ApiError {
    NotFound,
    Conflict,
    Backend(String),
}

/// A live transaction. Dropping it without `commit` silently rolls back, so
/// callers must not ignore the returned handle — yet nothing stops them.
pub struct Transaction<'a> {
    store: &'a Store,
    staged: HashMap<String, Vec<u8>>,
}

impl<'a> Transaction<'a> {
    pub fn set(&mut self, key: &str, value: Vec<u8>) {
        self.staged.insert(key.to_string(), value);
    }

    pub fn commit(self) -> Result<(), ApiError> {
        let _ = &self.store;
        Ok(())
    }
}

/// Our extension trait: anything `Storable` can be persisted by the store.
pub trait Storable {
    fn encode(&self) -> Vec<u8>;
}

/// Blanket impl over `Box<T>` — a fundamental type. Shipping this now locks the
/// crate into it forever and removes the variant from every downstream crate.
impl<T: Storable> Storable for Box<T> {
    fn encode(&self) -> Vec<u8> {
        (**self).encode()
    }
}

pub struct Store {
    data: HashMap<String, Vec<u8>>,
}

impl Store {
    pub fn open() -> Self {
        Store { data: HashMap::new() }
    }

    /// Begin a transaction. The returned guard rolls back on drop.
    pub fn begin(&self) -> Transaction<'_> {
        Transaction { store: self, staged: HashMap::new() }
    }

    /// Snapshot the store as a JSON document for the admin endpoint.
    pub fn snapshot(&self) -> serde_json::Value {
        let mut obj = serde_json::Map::new();
        for (k, v) in &self.data {
            obj.insert(k.clone(), serde_json::Value::from(v.len()));
        }
        serde_json::Value::Object(obj)
    }
}
