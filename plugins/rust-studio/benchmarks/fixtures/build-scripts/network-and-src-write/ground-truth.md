# Ground truth — build-scripts/network-and-src-write (agent: `build-engineer`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review this `build.rs`. It works on the maintainer's laptop and fails on CI 'sometimes'. List every finding with file:line and severity, then give a verdict."* Every defect is one `rules/build-scripts.md` names.

| id   | line   | type                        | severity | defect |
|------|--------|-----------------------------|----------|--------|
| GT-1 | 9–14   | NETWORK IN A BUILD SCRIPT   | 🔴 | `curl` downloads `protoc` at build time — non-hermetic, fails offline, unpinned by hash, and a supply-chain vector (whatever GitHub serves runs on every fresh build). Vendor the generated code, use `protoc-bin-vendored` / `prost-build`, or require `protoc` on PATH with a clear error. |
| GT-2 | 17–18, 22 | WRITES INTO `src/`       | 🔴 | Generated code goes to `src/generated` — the build mutates the source tree (dirty checkouts, races with the editor, CI diff noise). Write to `OUT_DIR` and `include!` it. |
| GT-3 | whole file | NO `rerun-if-changed`    | 🟠 | Not one `cargo:rerun-if-changed=proto/…` / `rerun-if-env-changed` — Cargo reruns the script on every build (slow) or, once a directive is added elsewhere, wrongly caches it. Declare every input. |
| GT-4 | 25–27  | FAILURE PRINTED, NOT FAILED | 🔴 | A failing `protoc` run prints a plain line to stdout (which Cargo treats as metadata) and the build continues with stale or missing output. Print to stderr and exit non-zero. |
| GT-5 | 10, 14, 16, 31 | HARDCODED PLATFORM PATHS | 🟠 | `/tmp/protoc`, a `linux-x86_64` archive, `/usr/local/lib` — breaks on macOS, Windows, and any cross build. Gate on `target_os`/`target_arch`, use `OUT_DIR`, probe with `pkg-config`. |
| GT-6 | 30     | SHELLING OUT TO `make`      | 🟠 | Vendored native code built by invoking `make` by hand instead of the `cc`/`cmake` crates — inherits the host's toolchain and none of Cargo's target/profile settings. |
| GT-7 | 12–14, 18, 24, 30 | `unwrap`/`expect` DIAGNOSTICS | 🟡 | Every failure is a panic with no install hint. Surface a clear message naming the missing tool and how to install it. |

Pass = GT-1, GT-2, GT-4 and at least two of the others, with a `NEEDS WORK` verdict.
