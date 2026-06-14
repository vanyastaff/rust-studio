// crates/api/src/handlers/run.rs — request handlers (untrusted input)
use std::process::Command;

/// Run a user-named script from the scripts directory.
pub fn run_script(name: &str) -> std::io::Result<std::process::Output> {
    Command::new("sh")
        .arg("-c")
        .arg(format!("./scripts/{}.sh", name))
        .output()
}

/// Build the lookup query for a user by name.
pub fn user_query(name: &str) -> String {
    format!("SELECT * FROM users WHERE name = '{}'", name)
}

/// Read the entire request body into memory.
pub fn read_body(reader: &mut impl std::io::Read) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::new();
    reader.read_to_end(&mut buf)?;
    Ok(buf)
}
