# Provision the Rust environment

This operation affects the machine. Resolve `scripts/env-setup.sh` relative to the installed
configure-tooling skill directory. Read the script before describing supported platforms,
tool tiers or commands: it is the source of truth. It is portable across skill hosts and
does not require a plugin checkout.

## Inspect and select scope

Run `bash "scripts/env-setup.sh" --check` from that skill directory. It is read-only and
reports the platform, Rust/rustup/binstall and installed/missing core, deep-quality/performance
and QoL tools. Empty input or `check` stops with that table and available installation choices.
If distro-packaged Rust is detected, preserve it. Verify whether rustup's PATH later shadows
it before considering removal that could break package dependents.

For requested installation, use already specified choices and ask only for missing scope:
core or full, OS prerequisites, nightly/miri, QoL tools, mold and sccache configuration.
OS package changes and optional home configuration must be within the authorized scope.
The script refuses root execution; cargo tools stay per-user and OS packages are the only
sudo step. Prefer prebuilt cargo-binstall packages and source compilation only when needed.

## Install and integrate

Run the script with the selected flags. `--yes` suppresses stdin prompts only after the
installation scope is authorized; it does not supply authorization. The script orders OS
prerequisites, rustup/stable, components, binstall and selected tools, prints mutations and
re-probes tools. Components include llvm-tools-preview for coverage. Read its current help
for exact flags rather than inventing a platform command.

If noninteractive sudo is unavailable, relay the exact command the script returns for the
user and stop that step. Preserve successful work and resume after the prerequisite is met.
A declined sudo action cannot be retried under another spelling or tool.

Handle these follow-ups only where applicable:

- Fresh rustup: refresh the current shell from its generated environment file and verify
  `rustc --version` resolves through rustup. The installer owns persistent shell setup.
- Requested sccache/mold: read and merge existing `~/.cargo/config.toml`. sccache sets
  `build.rustc-wrapper`. On Linux, verify mold and clang (at least 12) before adding the host
  target linker and `-fuse-ld=mold` flag. Unsupported configuration can break every link.
- macOS OpenSSL build failures: use the script's keg-only OpenSSL hint and verified Homebrew
  location when setting OPENSSL_DIR.
- Lefthook: use an authorized platform installation because it is not a crates.io tool.
- Windows: the script does not provision Windows. Use rustup-init.exe from rustup.rs and
  Visual Studio Build Tools, then the supported cargo-binstall path, within requested scope.
- CI: use the CI procedure and its toolchain/install actions, not this machine script.

## Verify capabilities

Retain the final probe table and exit code. A nonzero result means tools remain missing;
report target package availability, network failures or skipped extras specifically.
PATH/version checks alone do not prove runtime readiness. Linux flamegraph/samply need perf
and suitable perf_event_paranoid permissions; report restrictions and obtain authorization
before changing system policy. macOS flamegraph needs dtrace/sudo. cargo-fuzz, cargo-udeps
and cargo-careful need nightly at runtime. Mark skipped prerequisites as unavailable.

Finish COMPLETE / NEEDS WORK / BLOCKED against the selected tier and extras. Project CI
or test setup remains a separately requested configuration scope.
