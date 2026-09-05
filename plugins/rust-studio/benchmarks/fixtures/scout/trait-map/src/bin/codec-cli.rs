//! `codec-cli <name> <text>` — encodes text with the named codec and prints the bytes.

use acme_codec::registry_names_for_help;
use acme_codec::Registry;

fn main() {
    let mut args = std::env::args().skip(1);
    let (Some(name), Some(text)) = (args.next(), args.next()) else {
        eprintln!("usage: codec-cli <name> <text>; codecs: {}", registry_names_for_help());
        std::process::exit(2);
    };
    let registry: Registry = acme_codec::default_registry();
    match registry.encode_with(&name, text.as_bytes()) {
        Some(bytes) => println!("{bytes:?}"),
        None => {
            eprintln!("unknown codec {name}");
            std::process::exit(1);
        }
    }
}
