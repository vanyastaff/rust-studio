//! inventory — an in-memory stock ledger.
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Sku(pub String);

#[derive(Debug, Default)]
pub struct Ledger {
    stock: HashMap<Sku, u32>,
    history: Vec<String>,
}

impl Ledger {
    fn log(&mut self, entry: String) {
        self.history.push(entry);
    }

    /// Remove `qty` units of every SKU whose stock is at or below `threshold`, logging each.
    pub fn purge_low_stock(&mut self, threshold: u32, qty: u32) -> usize {
        let mut purged = 0;
        for (sku, count) in self.stock.iter_mut() {
            if *count <= threshold {
                *count = count.saturating_sub(qty);
                self.log(format!("purged {qty} of {}", sku.0));
                purged += 1;
            }
        }
        purged
    }

    /// The SKUs with the lowest stock first.
    pub fn sorted_by_stock(&self) -> Vec<(&Sku, u32)> {
        let mut rows: Vec<(&Sku, u32)> = self.stock.iter().map(|(s, c)| (s, *c)).collect();
        rows.sort_by_key(|(sku, count)| (count, sku));
        rows
    }

    pub fn total<T: Into<u64>>(&self, weights: &HashMap<Sku, T>) -> u64 {
        self.stock.iter().map(|(sku, count)| u64::from(*count) * weights.get(sku).map(|w| w.into()).unwrap_or(1)).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn purge_logs_each_sku() {
        let mut l = Ledger::default();
        l.stock.insert(Sku("a".into()), 1);
        l.stock.insert(Sku("b".into()), 10);
        assert_eq!(l.purge_low_stock(2, 1), 1);
        assert_eq!(l.history.len(), 1);
        assert_eq!(l.stock[&Sku("a".into())], 0);
    }

    #[test]
    fn sorted_lowest_first() {
        let mut l = Ledger::default();
        l.stock.insert(Sku("a".into()), 5);
        l.stock.insert(Sku("b".into()), 2);
        assert_eq!(l.sorted_by_stock()[0].0, &Sku("b".into()));
    }
}
