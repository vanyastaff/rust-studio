//! crate: `acme-engine` — `encode_batch` and `checksum` are on the per-request
//! hot path. Both allocate once per iteration over a large input. Correct output,
//! but the allocation profile fails the Performance Bar.

pub struct Record {
    pub key: String,
    pub value: u64,
}

/// Hot path: called per request over every record.
pub fn encode_batch(records: &[Record]) -> Vec<String> {
    let mut out = Vec::new(); // no capacity hint despite a known length
    for r in records {
        // fresh String every iteration
        let line = format!("{}:{}", r.key, r.value);
        // throwaway Vec per record just to re-join it
        let parts: Vec<String> = line.split(':').map(|s| s.to_string()).collect();
        out.push(parts.join("="));
    }
    out
}

/// Re-allocates a scratch buffer inside the loop instead of reusing one.
pub fn checksum(rows: &[&str]) -> u64 {
    let mut sum = 0u64;
    for row in rows {
        let mut buf = String::new(); // allocated every iteration
        buf.push_str(row);
        buf.make_ascii_uppercase();
        sum += buf.bytes().map(|b| b as u64).sum::<u64>();
    }
    sum
}
