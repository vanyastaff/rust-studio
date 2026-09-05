---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This is `src/main.rs` of a small CLI that deduplicates lines. It works when I run it by hand. Review it before we ship it to people who will call it from scripts and pipelines; list findings with line numbers and end with a verdict.

```rust
//! crate: `acme-dedup` — `src/main.rs`. A CLI that deduplicates lines from a file or stdin.
//! It works when run by hand. Every defect below is one `rules/cli.md` names, and each shows up
//! the first time the tool is used in a pipeline or a script.

use clap::Parser;
use std::collections::HashSet;
use std::io::{self, BufRead, Write};

#[derive(Parser)]
#[command(name = "dedup", version)]
struct Args {
    input: Option<String>,
    #[arg(long)]
    color: bool,
    #[arg(long, default_value = "auto")]
    mode: String,
}

fn main() {
    let args = Args::parse();
    let mode = std::env::var("DEDUP_MODE").unwrap_or(args.mode.clone());
    let reader: Box<dyn BufRead> = match &args.input {
        Some(path) => Box::new(io::BufReader::new(std::fs::File::open(path).unwrap())),
        None => Box::new(io::stdin().lock()),
    };
    let mut seen = HashSet::new();
    let mut count = 0usize;
    let stdout = io::stdout();
    let mut out = stdout.lock();
    for line in reader.lines() {
        let line = line.unwrap();
        if seen.insert(line.clone()) {
            if args.color {
                writeln!(out, "\x1b[32m{line}\x1b[0m").unwrap();
            } else {
                writeln!(out, "{line}").unwrap();
            }
            count += 1;
        }
    }
    println!("processed {} unique lines in mode {}", count, mode);
    if mode == "strict" && count == 0 {
        eprintln!("error: no input");
    }
}
```
