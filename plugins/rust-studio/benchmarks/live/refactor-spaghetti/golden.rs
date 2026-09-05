use acme_billing::{apply_discount, Order};
use std::collections::HashMap;
fn main() {
    let kinds = ["percent", "fixed", "bogo", "weird"];
    let mut out = Vec::new();
    for kind in kinds { for amount in [0u64, 10, 50, 101, 700, 60000] { for vip in [false, true] { for retry in [false, true] { for dry in [false, true] { for uses in [0u32, 3] { for subtotal in [0u64, 10_000, 250_000] {
        let mut o = Order { subtotal_cents: subtotal, items: vec![("a".into(), 3), ("b".into(), 2)], coupon_uses: HashMap::new() };
        if uses > 0 { o.coupon_uses.insert("C".into(), uses); }
        let r = apply_discount(&mut o, kind, "C", amount, vip, retry, dry);
        out.push(format!("{kind}|{amount}|{vip}|{retry}|{dry}|{uses}|{subtotal} => {:?} uses={:?}", r, o.coupon_uses.get("C")));
    }}}}}}}
    println!("{}", out.join("\n"));
}
