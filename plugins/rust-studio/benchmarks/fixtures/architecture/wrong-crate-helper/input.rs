//! crate: `nebula-http` (the HTTP transport crate).
//!
//! A checkout handler needed order math + an order rule, so the helpers were
//! dropped HERE — the easiest edit site — even though `nebula-domain` owns the
//! Order / Money / Currency concepts. The code compiles and the tests pass; the
//! defect is the SHAPE (wrong crate), which a reviewer would wave through.

use std::collections::HashMap;

/// Domain math living in the HTTP crate purely because the handler that first
/// needed it was written here.
pub fn compute_order_total(line_items: &[(u64, u32)], tax_bps: u32) -> u64 {
    let subtotal: u64 = line_items.iter().map(|(price, qty)| price * *qty as u64).sum();
    subtotal + subtotal * tax_bps as u64 / 10_000
}

/// Domain invariant (an order needs ≥1 line and a known currency), also defined
/// in the HTTP crate, next to the route that calls it.
pub fn validate_order(line_items: &[(u64, u32)], currency: &str) -> Result<(), String> {
    if line_items.is_empty() {
        return Err("order has no line items".into());
    }
    if !matches!(currency, "USD" | "EUR" | "GBP") {
        return Err(format!("unknown currency: {currency}"));
    }
    Ok(())
}

pub async fn handle_checkout(req: HashMap<String, String>) -> Result<u64, String> {
    let items = vec![(1000u64, 2u32), (500, 1)];
    let currency = req.get("currency").map(|s| s.as_str()).unwrap_or("USD");
    validate_order(&items, currency)?;
    Ok(compute_order_total(&items, 825))
}
