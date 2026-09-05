//! crate: `acme-proto` — `build.rs`. It generates Rust from the `.proto` files and "just works"
//! on the maintainer's laptop. Every defect below is one `rules/build-scripts.md` names; each
//! one becomes visible the first time someone builds offline, on CI, or on macOS.

use std::path::Path;
use std::process::Command;

fn main() {
    let status = Command::new("curl")
        .args(["-sSL", "https://github.com/protocolbuffers/protobuf/releases/download/v25.1/protoc-25.1-linux-x86_64.zip", "-o", "/tmp/protoc.zip"])
        .status()
        .expect("curl must be installed");
    assert!(status.success());
    Command::new("unzip").args(["-o", "/tmp/protoc.zip", "-d", "/tmp/protoc"]).status().unwrap();

    let protoc = "/tmp/protoc/bin/protoc";
    let out = Path::new("src/generated");
    std::fs::create_dir_all(out).unwrap();
    for entry in std::fs::read_dir("proto").unwrap() {
        let path = entry.unwrap().path();
        let status = Command::new(protoc)
            .args(["--rust_out", out.to_str().unwrap(), "-I", "proto", path.to_str().unwrap()])
            .status()
            .unwrap();
        if !status.success() {
            println!("protoc failed for {}", path.display());
        }
    }

    Command::new("make").args(["-C", "native"]).status().unwrap();
    println!("cargo:rustc-link-search=/usr/local/lib");
    println!("cargo:rustc-link-lib=acmenative");
}
