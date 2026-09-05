//! `acme <dir>` — opens the store and prints its root.

use std::path::Path;

fn main() {
    let dir = std::env::args().nth(1).unwrap_or_else(|| ".".to_string());
    match acme_store::TypedStore::open(Path::new(&dir), acme_core::Config::default()) {
        Ok(store) => println!("{}", store.store().root().display()),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
