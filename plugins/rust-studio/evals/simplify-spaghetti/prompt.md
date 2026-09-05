---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is `crates/billing/src/discount.rs`. Nobody on the team can follow `apply_discount` any more. Make it readable for a human — behavior must stay exactly identical, including error messages. Tell me how you would go about it and what you would change, then give a verdict on the code as it stands.

```rust
//! crate: `acme-billing` (internal). `apply_discount` has grown one special case at a time
//! for two years. It compiles, clippy (default lints) is clean, the one test is green, and
//! nobody on the team can say what it does without tracing every branch. The request is
//! "make this readable — behavior must stay identical". The defect is the SHAPE, and the
//! trap is to rewrite it from the top before the current behavior is pinned.

use std::collections::HashMap;

pub struct Order {
    pub subtotal_cents: u64,
    pub items: Vec<(String, u32)>,
    pub coupon_uses: HashMap<String, u32>,
}

/// Apply a discount and return the discounted total in cents.
///
/// `kind` is one of "percent", "fixed", "bogo". `vip` enables the VIP bonus, `retry` means the
/// caller is retrying after a failure, `dry` means don't record the coupon use.
pub fn apply_discount(
    order: &mut Order,
    kind: &str,
    code: &str,
    amount: u64,
    vip: bool,
    retry: bool,
    dry: bool,
) -> Result<u64, String> {
    let mut total = order.subtotal_cents;
    if kind == "percent" {
        if amount > 100 {
            return Err(format!("bad percent: {}", amount));
        } else {
            if vip {
                let d = total * (amount + 5) / 100;
                let d = if d > 50000 { 50000 } else { d };
                total = total - d;
            } else {
                let d = total * amount / 100;
                let d = if d > 50000 { 50000 } else { d };
                total = total - d;
            }
            if !dry {
                let n = order.coupon_uses.entry(code.to_string()).or_insert(0);
                if *n >= 3 && !retry {
                    return Err(format!("coupon {} exhausted", code));
                }
                *n += 1;
            }
        }
    } else if kind == "fixed" {
        if vip {
            let d = amount + 500;
            let d = if d > 50000 { 50000 } else { d };
            total = if d > total { 0 } else { total - d };
        } else {
            let d = amount;
            let d = if d > 50000 { 50000 } else { d };
            total = if d > total { 0 } else { total - d };
        }
        if !dry {
            let n = order.coupon_uses.entry(code.to_string()).or_insert(0);
            if *n >= 3 && !retry {
                return Err(format!("coupon {} exhausted", code));
            }
            *n += 1;
        }
    } else if kind == "bogo" {
        // buy one get one: the cheapest item of every pair is free
        let mut prices: Vec<u64> = Vec::new();
        for (_, q) in &order.items {
            for _ in 0..*q {
                prices.push(total / (order.items.len() as u64).max(1));
            }
        }
        prices.sort();
        let mut i = 0;
        let mut d = 0;
        while i + 1 < prices.len() {
            d += prices[i];
            i += 2;
        }
        if vip {
            d += 500;
        }
        let d = if d > 50000 { 50000 } else { d };
        total = if d > total { 0 } else { total - d };
        if !dry {
            let n = order.coupon_uses.entry(code.to_string()).or_insert(0);
            if *n >= 3 && !retry {
                return Err(format!("coupon {} exhausted", code));
            }
            *n += 1;
        }
    } else {
        return Err(format!("unknown kind: {}", kind));
    }
    if dry {
        println!("dry run: {} -> {}", order.subtotal_cents, total);
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    // The only test. Passes for any implementation that returns Ok.
    #[test]
    fn percent_works() {
        let mut o = Order { subtotal_cents: 10_000, items: vec![], coupon_uses: HashMap::new() };
        assert!(apply_discount(&mut o, "percent", "SAVE10", 10, false, false, false).is_ok());
    }
}
```
