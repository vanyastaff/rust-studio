// crates/widget/src/lib.rs — the public crate root
use serde_json::Value;

pub enum Status {
    Ok,
    Retrying,
}

pub fn configure(raw: Value) -> Status {
    let _ = raw;
    Status::Ok
}

pub fn parse_id(input: &str) -> Result<u32, ()> {
    input.parse().map_err(|_| ())
}
