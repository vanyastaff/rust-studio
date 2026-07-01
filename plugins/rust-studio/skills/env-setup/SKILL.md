---
name: env-setup
description: "env setup bootstrap machine install rust rustup toolchain binstall cargo tools OS packages — provision a development machine for the studio: OS build prerequisites, latest stable Rust via rustup (+ components), cargo-binstall, and the studio's cargo tool suite installed from prebuilt binaries. Use on a fresh machine, after a distro reinstall, or when a studio skill reports a missing tool."
argument-hint: "[check | core | full]  (default: check, then offer to install)"
user-invocable: true
---

# /env-setup — provision the machine for Rust + the studio tool suite

Bring a machine from "has a shell" to "every studio skill's tool is on PATH": OS build
prerequisites → rustup + latest stable → toolchain components → `cargo-binstall` →
cargo tools as **prebuilt binaries** (compiling 20 tools from source takes an hour;
binstall takes minutes). This skill touches the **system**, not the repo — no
`rust-builder`. The mechanical work lives in one idempotent script:

    bash "${CLAUDE_PLUGIN_ROOT}/scripts/env-setup.sh" --help

**The script is the single source of truth** for the tool tiers, package names per
platform, and install commands — read it before explaining, don't restate lists from
memory. It maps to the studio canon in `${CLAUDE_PLUGIN_ROOT}/docs/tooling.md` ("Cargo &
Rust toolchain" table). It refuses to run as root; OS packages are its one `sudo` step.

## Phase 1 — Detect (read-only, always)

1. Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/env-setup.sh" --check` — prints the platform,
   rustup/rustc/binstall state, and an installed/missing table for all three tiers
   (core / deep-quality+perf / QoL). Mutates nothing.
2. Flag a **distro-packaged Rust** if the report warns about it (`rustc` without rustup):
   it lags stable. rustup puts `~/.cargo/bin` first on PATH, which normally shadows it —
   prefer shadowing; recommend removing the distro package only if it still wins after
   install (removal can cascade to dependents).
3. Show the table. If `$ARGUMENTS` is `check` or empty, stop after offering: install
   `core`, `full`, or nothing.

## Phase 2 — Scope (gate)

`AskUserQuestion` (skip what `$ARGUMENTS` already decided; batch the rest in one ask):
- **Tier:** `core` (what the everyday skills need: `/verify-loop`, `/coverage`,
  `/deps-check`, `/security-audit`, `/msrv-check`, `/api-review`) or `full` (adds the
  deep-quality/perf tier: `/mutants`, `/fuzz`, `/bloat`, `/perf`).
- **Extras** (multi-select): OS prerequisites (the sudo step — skip if the report shows a
  working C toolchain); nightly toolchain + miri (`/audit-unsafe`; `cargo-udeps`,
  `cargo-fuzz`, `cargo-careful` need nightly at *run* time); QoL CLI tools; the memory
  stack (`--memory`: obsidian-mcp with local embeddings — backs `/recall`, `/remember`,
  `/session-wrap`; the one tool that compiles from source, since prebuilt binaries don't
  carry the `embeddings` feature); mold linker config; sccache config.

## Phase 3 — Install

Run the script once with the chosen flags, e.g.:

    bash "${CLAUDE_PLUGIN_ROOT}/scripts/env-setup.sh" --full --qol --nightly --os-deps --yes

`--yes` is appropriate because Phase 2 already was the consent; without it the script
prompts on its own stdin, which does not work inside the harness. It prints every
mutating command before running it. What it does, in dependency order: OS prerequisites
(one package-manager command; `dnf`/`apt`/`pacman`/`zypper`/`apk`/`brew`; the full tier
adds the `perf` package on Linux — flamegraph/samply are inert without it) → rustup
(official `sh.rustup.rs` bootstrap, or `rustup update` if present) → components
(`clippy rustfmt rust-analyzer rust-src llvm-tools-preview` — the last is what
`cargo-llvm-cov` links against; install it now, not at first `/coverage` failure) →
`cargo-binstall` (prebuilt bootstrap from the cargo-bins release, `cargo install`
fallback) → batched `cargo binstall -y` per tier (binstall falls back to compiling only
when a crate ships no prebuilt binary). Exits non-zero if anything is still missing after
install.

**If the script hands a command back** instead of running it, relay it verbatim and stop
that step there: it probes `sudo -n` first, and when sudo needs a password with no TTY
(the harness case) it prints the exact `sudo …` line for the user to run themselves —
suggest they run it via `! <command>` in the prompt, then re-run the script.

**Follow-ups the script deliberately does not do** — handle them yourself:

- **PATH (fresh rustup install only):** the installer edits shell rc files, so only the
  *current* session is stale — tell the user the one line:
  `. "$HOME/.cargo/env"` (sh/bash/zsh) or `source "$HOME/.cargo/env.fish"` (fish — the
  file only exists when rustup's installer detected fish; older installs lack it).
- **Optional configs** (only if chosen in Phase 2; MERGE into an existing
  `~/.cargo/config.toml`, never clobber — read it first):
  - sccache: `[build] rustc-wrapper = "sccache"`.
  - mold (Linux; needs the `clang mold` OS packages): under
    `[target.x86_64-unknown-linux-gnu]` (or the host triple), `linker = "clang"` and
    `rustflags = ["-C", "link-arg=-fuse-ld=mold"]`. Probe `mold --version` and
    `clang --version` (≥ 12) *before* writing — on an unsupported host this config
    silently breaks every link.
- **macOS OpenSSL:** brew's `openssl` is keg-only, so `openssl-sys` won't find it via
  pkg-config alone — if a build fails on it, set
  `export OPENSSL_DIR="$(brew --prefix openssl@3)"` (the script prints this hint too).
- **Memory-stack registration** (after `--memory` installs `obsidian-mcp`): the MCP
  server must be registered in *user* scope so agent teammates inherit it — the script
  prints the `claude mcp add obsidian -s user …` line; fill `OBSIDIAN_VAULT_PATH` from
  the plugin's `vault_path` setting, the `OBSIDIAN_VAULT_PATH` env var, or `~/memory`
  (that resolution order matches the session-start hook). Full contract:
  `${CLAUDE_PLUGIN_ROOT}/docs/tooling.md` ("obsidian memory server").
- **Not on crates.io, so not binstallable:** `lefthook` (Go) — needed by `/ci-gate`;
  offer the platform package (`brew install lefthook`, `npm i -g lefthook`, or the vendor
  repo) or leave it to `/ci-gate` to prompt.
- **Windows** is out of scope for the script — point the user at `rustup-init.exe` from
  rustup.rs plus Visual Studio Build Tools, then `cargo binstall` works the same.
- **CI** is a different problem — use `dtolnay/rust-toolchain` + `taiki-e/install-action`
  there (see `${CLAUDE_PLUGIN_ROOT}/docs/ci-best-practices.md`), never this script.

## Phase 4 — Verify (evidence, not assertion)

The script re-probes every tool after installing and prints a final table (its exit code
is the gate: non-zero = something is still missing). Paste that real output. For anything
still missing, say why: no prebuilt for this target, a network failure, or a tool that
needs the nightly extra. If rustup was just installed, confirm `rustc --version` resolves
to rustup's stable (not a distro binary) after sourcing the env file.

`--version` proves PATH-present, not usable — for tools with OS-level runtime
dependencies, check the capability too:
- **flamegraph/samply (Linux):** need `perf` on PATH and `kernel.perf_event_paranoid ≤ 1`
  (the script warns when it is higher; the fix is
  `sudo sysctl kernel.perf_event_paranoid=1`). On macOS flamegraph needs `dtrace` + sudo.
- **cargo-fuzz / cargo-udeps / cargo-careful:** need the nightly toolchain at run time —
  if the nightly extra was skipped, say so in the report instead of calling them ready.

## Phase 5 — Verdict and hand-off

**COMPLETE / NEEDS WORK / BLOCKED**, then next steps: `/detect-stack` from a project root
to classify the codebase, `/ci-gate` to install the anti-hang gate (now that nextest and
lefthook exist), `/test-setup` to wire the test toolchain into a project.

## Do not
- Do not `cargo install` a tool that binstall can fetch — compiling the suite from source
  is the failure mode this skill exists to avoid. `cargo install` is the *fallback*.
- Do not run the rustup or binstall bootstrap scripts as root, and do not `sudo cargo ...`
  — everything under `~/.cargo` is per-user.
- Do not let a distro-packaged Rust shadow rustup's — `~/.cargo/bin` must win on PATH;
  remove the distro package only if PATH precedence doesn't already settle it.
- Do not edit shell rc files by hand — rustup's installer already handles them; only tell
  the user the one `source` line the current session needs.
- Do not retry a failed `sudo` command verbatim after the user declines it — ask, or mark
  the tier skipped.
