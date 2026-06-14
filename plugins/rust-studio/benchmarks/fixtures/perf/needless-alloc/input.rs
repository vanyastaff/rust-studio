// crates/engine/src/aggregate.rs — sum_labels is called once per event on the hot path
pub fn sum_labels(events: &[Event]) -> u64 {
    let mut total = 0u64;
    for e in events {
        let labels: Vec<String> = e.labels.clone();
        let mut seen = Vec::new();
        for l in &labels {
            if !seen.contains(l) {
                seen.push(l.clone());
            }
        }
        total += seen.len() as u64;
    }
    total
}
