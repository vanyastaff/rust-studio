---
type: llm
weight: 3
---
The response must find (anchored within two lines):
1. Lines 9–14: the build script downloads `protoc` from the network with `curl` — non-hermetic, fails offline, unpinned, a supply-chain vector.
2. Lines 17–18, 22: generated code is written into `src/generated` instead of `OUT_DIR` (+ `include!`).
3. Lines 25–27: a failing `protoc` run is printed with `println!` (which Cargo treats as metadata) and the build continues — errors must go to stderr and exit non-zero.
It should also flag at least two of: no `cargo:rerun-if-changed` / `rerun-if-env-changed` directives anywhere; hardcoded platform paths (`/tmp`, a linux-x86_64 archive, `/usr/local/lib`, lines 10, 14, 16, 31); shelling out to `make` instead of the `cc`/`cmake` crates (line 30); `unwrap`/`expect` failures with no install hint (lines 12–14, 18, 24, 30).
Full credit: all three numbered plus two others and a NEEDS WORK verdict. Partial: two numbered plus one. Fail: misses the network download, or approves.
