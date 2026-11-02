---
name: build-scripts
paths: "**/build.rs"
description: build.rs hygiene
---

# Build Script Standards

Applies to `build.rs`.

## Determinism & speed
- A build script must be deterministic and offline. **No network access**, no reading
  outside the crate / `OUT_DIR` / declared inputs.
- Emit `cargo:rerun-if-changed=` / `cargo:rerun-if-env-changed=` for every input, so
  Cargo doesn't needlessly rerun (or wrongly cache) the script.
- Keep it fast and minimal — it runs on every fresh build and blocks compilation.

## Outputs
- Generated code goes to `OUT_DIR` and is `include!`d; never write into `src/`.
- Use `cargo:rustc-cfg=` / `cargo:rustc-env=` / `cargo:rustc-link-*` instead of ad-hoc
  side effects. Print errors to stderr and exit non-zero on failure.

## FFI / native deps
- Probe with `pkg-config`/`vcpkg` and fall back gracefully; surface a clear error if a
  system library is missing, with install hints.
- Don't hardcode paths or assume a platform; gate on `target_os`/`target_arch`.
- Vendored sources compiled via `cc`/`cmake` crates, not shelling out manually.
