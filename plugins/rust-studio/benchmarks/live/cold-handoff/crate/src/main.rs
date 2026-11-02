use std::env;

fn run() -> Result<(), &'static str> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.len() != 3 {
        return Err("usage: range-check START END VALUE");
    }
    let mut values = Vec::new();
    for arg in args {
        values.push(arg.parse::<i64>().map_err(|_| "expected an i64 integer")?);
    }
    if values[0] > values[1] {
        return Err("inverted range");
    }
    println!(
        "{}",
        if cold_handoff::contains(values[0], values[1], values[2]) {
            "inside"
        } else {
            "outside"
        }
    );
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}
