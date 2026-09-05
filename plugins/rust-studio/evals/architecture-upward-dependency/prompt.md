---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is `crates/acme-domain/src/lib.rs`, the lowest layer of our workspace (its README says: pure business rules, no transport, no storage, no framework types). We are about to add a `refund` flow to it. Is the crate in shape to extend? Give the pre-code maintainer verdict and say what you would change first.

```rust
//! crate: `acme-domain` — the workspace's lowest layer. Its README says: "pure business
//! rules; no transport, no storage, no framework types." Three crates depend on it:
//! `acme-api` (axum handlers), `acme-worker` (background jobs), `acme-cli`.
//!
//! The team is about to add a `refund` flow here. Everything below compiles and the
//! workspace tests are green. The question is whether this crate is in shape to extend.

use axum::http::StatusCode; // pulled in "just for the status enum"
use sqlx::PgPool;
use std::collections::HashMap;

pub mod utils {
    /// Used by acme-api for URL slugs.
    pub fn slugify(s: &str) -> String {
        s.to_lowercase().replace(' ', "-")
    }
    /// Used by acme-worker to read a feature flag.
    pub fn parse_env_bool(key: &str) -> bool {
        std::env::var(key).map(|v| v == "1" || v == "true").unwrap_or(false)
    }
    /// Used by acme-cli for log lines.
    pub fn now_millis() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    }
}

#[derive(Debug, Clone)]
pub struct Invoice {
    pub id: u64,
    pub customer_id: u64,
    pub amount_cents: u64,
    /// HTTP status of the last sync with the payment provider — reused as the invoice's
    /// lifecycle state ("200 = settled, 402 = unpaid, 409 = disputed").
    pub status: StatusCode,
}

/// Settle an invoice: charge the customer and persist the new state.
pub async fn settle(pool: &PgPool, invoice: &mut Invoice) -> Result<(), acme_api::ApiError> {
    if invoice.status == StatusCode::OK {
        return Err(acme_api::ApiError::conflict("already settled"));
    }
    sqlx::query("UPDATE invoices SET status = $1 WHERE id = $2")
        .bind(200_i32)
        .bind(invoice.id as i64)
        .execute(pool)
        .await
        .map_err(acme_api::ApiError::from)?;
    invoice.status = StatusCode::OK;
    Ok(())
}

/// Everything about a customer's ledger, in one place.
pub struct Ledger {
    entries: Vec<Invoice>,
    by_customer: HashMap<u64, Vec<usize>>,
    metrics: LedgerMetrics,
    pool: PgPool,
}

#[derive(Default)]
pub struct LedgerMetrics {
    pub settled: u64,
    pub disputed: u64,
}

impl Ledger {
    pub fn record(&mut self, invoice: Invoice) {
        let idx = self.entries.len();
        self.by_customer.entry(invoice.customer_id).or_default().push(idx);
        self.entries.push(invoice);
    }

    pub fn bump_settled(&mut self) {
        self.metrics.settled += 1;
    }

    /// Callers hit a borrow error trying to iterate `entries` while calling `bump_settled`,
    /// so this clones the whole list first.
    pub fn settle_all(&mut self) -> Vec<Invoice> {
        let snapshot = self.entries.clone();
        for inv in &snapshot {
            if inv.status != StatusCode::OK {
                self.bump_settled();
            }
        }
        snapshot
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

// Cargo.toml (excerpt):
//
// [dependencies]
// axum = "0.8"
// sqlx = { version = "0.8", features = ["postgres", "runtime-tokio"] }
//
// [dev-dependencies]
// acme-api = { path = "../acme-api" }   # "only for ApiError in tests" — but `settle` above
//                                       # names it in a non-test signature, and acme-api
//                                       # depends on acme-domain.
```
