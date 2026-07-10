#!/usr/bin/env bash
# env-setup.sh — provision a machine for Rust + the studio tool suite.
# Backs the /env-setup skill; also usable standalone.
#
# Usage: env-setup.sh [--check] [--core] [--full] [--qol] [--nightly] [--os-deps]
#                     [--memory] [--yes] [--dry-run]
#
#   --check     report installed vs missing and exit (default when no tier given)
#   --core      rustup + stable + components + binstall + core cargo tools
#   --full      --core plus deep-quality/perf tools
#   --qol       also install quality-of-life CLI tools
#   --nightly   also install the nightly toolchain with miri + rust-src
#   --os-deps   also install OS build prerequisites (the one sudo step)
#   --memory    also install obsidian-mcp with local embeddings (compiles from source)
#   --yes       non-interactive: skip confirmation prompts
#   --dry-run   print every mutating command instead of running it
#
# Never run this script as root: everything under ~/.cargo is per-user.

set -euo pipefail

CHECK_ONLY=1
CORE=0 FULL=0 QOL=0 NIGHTLY=0 OS_DEPS=0 MEMORY=0 YES=0 DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --check)   CHECK_ONLY=1 ;;
    --core)    CORE=1; CHECK_ONLY=0 ;;
    --full)    CORE=1; FULL=1; CHECK_ONLY=0 ;;
    --qol)     QOL=1; CHECK_ONLY=0 ;;
    --nightly) NIGHTLY=1; CHECK_ONLY=0 ;;
    --os-deps) OS_DEPS=1; CHECK_ONLY=0 ;;
    --memory)  MEMORY=1; CHECK_ONLY=0 ;;
    --yes)     YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg (see --help)" >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" = 0 ]; then
  echo "error: do not run as root — rustup and cargo tools are per-user." >&2
  exit 1
fi

# ---------- helpers ----------------------------------------------------------

run() { # print, confirm once via --yes or prompt, then execute
  echo "+ $*"
  if [ "$DRY_RUN" = 1 ]; then return 0; fi
  "$@"
}

confirm() { # confirm <message>; auto-yes with --yes
  [ "$YES" = 1 ] && return 0
  printf '%s [y/N] ' "$1"
  read -r reply
  [ "$reply" = y ] || [ "$reply" = Y ]
}

have() { command -v "$1" >/dev/null 2>&1; }

# ---------- platform detection ------------------------------------------------

OS="$(uname -s)"
PKG=""
if [ "$OS" = Darwin ]; then
  PKG=brew
elif [ -r /etc/os-release ]; then
  # ID_LIKE covers derivatives (e.g. ubuntu -> debian, nobara -> fedora)
  ids="$(. /etc/os-release; echo "${ID:-} ${ID_LIKE:-}")"
  case " $ids " in
    *fedora*|*rhel*|*centos*) PKG=dnf ;;
    *debian*|*ubuntu*)        PKG=apt ;;
    *arch*)                   PKG=pacman ;;
    *suse*)                   PKG=zypper ;;
    *alpine*)                 PKG=apk ;;
  esac
fi
echo "platform: $OS (package manager: ${PKG:-unknown})"

# ---------- tool inventory -----------------------------------------------------

# "probe-command|crate-or-note" — probe runs with --version/-V appended below
CORE_TOOLS=(
  "cargo nextest|cargo-nextest"
  "cargo llvm-cov|cargo-llvm-cov"
  "cargo deny|cargo-deny"
  "cargo audit|cargo-audit"
  "cargo outdated|cargo-outdated"
  "cargo hack|cargo-hack"
  "cargo shear|cargo-shear"
  "cargo msrv|cargo-msrv"
  "cargo semver-checks|cargo-semver-checks"
  "cargo public-api|cargo-public-api"
  "cargo expand|cargo-expand"
)
FULL_TOOLS=(
  "cargo mutants|cargo-mutants"
  "cargo fuzz|cargo-fuzz"
  "cargo bloat|cargo-bloat"
  "cargo udeps|cargo-udeps"
  "cargo careful|cargo-careful"
  "cargo flamegraph|flamegraph"
  "samply|samply"
  "hyperfine|hyperfine"
  "cargo modules|cargo-modules"
  "cargo llvm-lines|cargo-llvm-lines"
  "cargo insta|cargo-insta"
  "cargo hakari|cargo-hakari"
)
QOL_TOOLS=(
  "bacon|bacon"
  "tokei|tokei"
  "just|just"
  "fd|fd-find"
  "rg|ripgrep"
  "ast-grep|ast-grep"
  "delta|git-delta"
  "typos|typos-cli"
  "sccache|sccache"
)

probe() { # probe "cargo nextest" -> 0 if it answers --version or its binary is on PATH
  # shellcheck disable=SC2086 — word-splitting the probe command is intended
  $1 --version >/dev/null 2>&1 && return 0
  # some tools (e.g. cargo-careful) have no --version — fall back to PATH presence
  have "${1// /-}"
}

report_tier() { # report_tier <label> <array-name>
  local label="$1"; shift
  local entry cmd crate missing=()
  echo "-- $label --"
  for entry in "$@"; do
    cmd="${entry%%|*}"; crate="${entry##*|}"
    if probe "$cmd"; then
      printf '  ok       %-20s %s\n' "$crate" "$($cmd --version 2>/dev/null | head -1 || true)"
    else
      printf '  MISSING  %s\n' "$crate"
      missing+=("$crate")
    fi
  done
  MISSING_CRATES+=("${missing[@]+"${missing[@]}"}")
}

echo
echo "== current state =="
if have rustup; then
  echo "rustup:  $(rustup --version 2>/dev/null | head -1)"
  echo "rustc:   $(rustc --version 2>/dev/null || echo 'none on PATH')"
else
  echo "rustup:  MISSING"
  if have rustc; then
    echo "WARNING: rustc without rustup — a distro-packaged Rust. It lags stable. rustup"
    echo "         puts ~/.cargo/bin first on PATH, which normally shadows it; remove the"
    echo "         distro package only if it still wins after install."
  fi
fi
if have cargo && cargo binstall -V >/dev/null 2>&1; then
  echo "binstall: $(cargo binstall -V 2>/dev/null | head -1)"
else
  echo "binstall: MISSING"
fi
if have obsidian-mcp; then
  echo "obsidian-mcp: $(command -v obsidian-mcp)  (studio memory server)"
else
  echo "obsidian-mcp: MISSING  (studio memory server — install with --memory)"
fi

MISSING_CRATES=()
report_tier "core"              "${CORE_TOOLS[@]}"
report_tier "deep quality/perf" "${FULL_TOOLS[@]}"
report_tier "QoL"               "${QOL_TOOLS[@]}"

if [ "$CHECK_ONLY" = 1 ]; then
  echo
  echo "check-only mode; re-run with --core / --full (add --qol --nightly --os-deps) to install."
  exit 0
fi

# ---------- 1. OS prerequisites ------------------------------------------------

if [ "$OS_DEPS" = 1 ]; then
  echo
  echo "== OS build prerequisites =="
  # the full tier ships flamegraph/samply — on Linux they are inert without perf(1)
  perf_pkg=""
  if [ "$FULL" = 1 ] && [ "$OS" = Linux ]; then
    case "$PKG" in
      apt) case " ${ids:-} " in *ubuntu*) perf_pkg="linux-tools-generic" ;; *) perf_pkg="linux-perf" ;; esac ;;
      dnf|pacman|zypper|apk) perf_pkg="perf" ;;
    esac
  fi
  case "$PKG" in
    dnf)    os_cmd=(sudo dnf install -y gcc gcc-c++ make pkgconf-pkg-config openssl-devel cmake git curl) ;;
    apt)    os_cmd=(sudo apt-get install -y build-essential pkg-config libssl-dev cmake git curl) ;;
    pacman) os_cmd=(sudo pacman -S --needed --noconfirm base-devel pkgconf openssl cmake git curl) ;;
    zypper) os_cmd=(sudo zypper install -y gcc gcc-c++ make pkgconf-pkg-config libopenssl-devel cmake git curl) ;;
    apk)    os_cmd=(sudo apk add build-base pkgconf openssl-dev cmake git curl) ;;
    brew)   os_cmd=(brew install pkg-config cmake openssl) ;;
    *)      echo "unknown package manager — install a C toolchain, pkg-config, and OpenSSL headers manually."; os_cmd=() ;;
  esac
  [ -n "$perf_pkg" ] && os_cmd+=("$perf_pkg")
  if [ "$PKG" = brew ] && ! xcode-select -p >/dev/null 2>&1; then
    echo "Xcode Command Line Tools missing — run 'xcode-select --install' yourself (GUI prompt), then re-run."
  fi
  if [ "${#os_cmd[@]}" -gt 0 ] && confirm "run: ${os_cmd[*]} ?"; then
    if [ "${os_cmd[0]}" = sudo ] && [ "$DRY_RUN" = 0 ] && ! sudo -n true 2>/dev/null && ! [ -t 0 ]; then
      echo "sudo needs a password and there is no TTY — run this yourself, then re-run the script:"
      echo "    ${os_cmd[*]}"
    else
      run "${os_cmd[@]}"
      if [ "$PKG" = brew ]; then
        echo "note: brew's openssl is keg-only — if an openssl-sys build can't find it, set:"
        echo '  export OPENSSL_DIR="$(brew --prefix openssl@3)"'
      fi
    fi
  else
    echo "skipped OS prerequisites."
  fi
fi

# ---------- 2. rustup + stable ---------------------------------------------------

echo
echo "== rustup + stable toolchain =="
if ! have rustup; then
  if confirm "install rustup from https://sh.rustup.rs ?"; then
    echo "+ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable"
    if [ "$DRY_RUN" = 0 ]; then
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    fi
    # make the rest of THIS run work; the user's next shell gets it from rc files
    [ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
  else
    echo "rustup declined — cannot continue."; exit 1
  fi
else
  run rustup update
fi
run rustup component add clippy rustfmt rust-analyzer rust-src llvm-tools-preview
if [ "$NIGHTLY" = 1 ]; then
  run rustup toolchain install nightly --component miri --component rust-src
fi

# ---------- 3. cargo-binstall -----------------------------------------------------

echo
echo "== cargo-binstall =="
if ! cargo binstall -V >/dev/null 2>&1; then
  bootstrap_url="https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh"
  if confirm "install cargo-binstall (prebuilt) from $bootstrap_url ?"; then
    echo "+ curl -L --proto '=https' --tlsv1.2 -sSf $bootstrap_url | bash"
    if [ "$DRY_RUN" = 0 ]; then
      curl -L --proto '=https' --tlsv1.2 -sSf "$bootstrap_url" | bash
    fi
  else
    echo "falling back to: cargo install cargo-binstall (compiles — slow)"
    run cargo install cargo-binstall
  fi
fi

# ---------- 4. cargo tools ---------------------------------------------------------

crates_of() { local e out=(); for e in "$@"; do out+=("${e##*|}"); done; echo "${out[@]}"; }

echo
echo "== cargo tools (prebuilt via binstall) =="
# shellcheck disable=SC2046 — the crate lists are single words by construction
if [ "$CORE" = 1 ]; then
  run cargo binstall -y $(crates_of "${CORE_TOOLS[@]}")
fi
if [ "$FULL" = 1 ]; then
  run cargo binstall -y $(crates_of "${FULL_TOOLS[@]}")
fi
if [ "$QOL" = 1 ]; then
  run cargo binstall -y $(crates_of "${QOL_TOOLS[@]}")
fi

# ---------- 5. verify ---------------------------------------------------------------

echo
echo "== verify =="
MISSING_CRATES=()
echo "rustc:   $(rustc --version 2>/dev/null || echo MISSING)"
echo "cargo:   $(cargo --version 2>/dev/null || echo MISSING)"
[ "$CORE" = 1 ] && report_tier "core" "${CORE_TOOLS[@]}"
[ "$FULL" = 1 ] && report_tier "deep quality/perf" "${FULL_TOOLS[@]}"
[ "$QOL" = 1 ]  && report_tier "QoL" "${QOL_TOOLS[@]}"

if [ "$MEMORY" = 1 ]; then
  echo
  echo "== obsidian memory server (cross-session studio memory) =="
  if have obsidian-mcp; then
    echo "obsidian-mcp already installed: $(command -v obsidian-mcp)"
  else
    # prebuilt binaries don't carry the embeddings feature — this one must compile
    run cargo install obsidian-mcp --features embeddings
  fi
  echo "register it once (user scope, so agent teammates inherit it):"
  echo '  claude mcp add obsidian -s user \'
  echo '    -e OBSIDIAN_VAULT_PATH=<your-vault> -e OBSIDIAN_EMBEDDINGS=true -- obsidian-mcp'
  echo "note: the first semantic search downloads the embedding model (~130 MB) once."
fi

if [ "$FULL" = 1 ] && [ "$OS" = Linux ] && [ -r /proc/sys/kernel/perf_event_paranoid ]; then
  paranoid="$(cat /proc/sys/kernel/perf_event_paranoid)"
  if [ "$paranoid" -gt 1 ]; then
    echo
    echo "note: kernel.perf_event_paranoid=$paranoid — flamegraph/samply cannot profile until:"
    echo "  sudo sysctl kernel.perf_event_paranoid=1   (persist in /etc/sysctl.d/ if wanted)"
  fi
fi

echo
if [ "${#MISSING_CRATES[@]}" -gt 0 ] && [ "$DRY_RUN" = 0 ]; then
  echo "still missing: ${MISSING_CRATES[*]}"
  echo "(no prebuilt for this target, a network failure, or a tool that needs nightly at run time)"
  exit 1
fi
echo "done. If rustup was just installed, run:  . \"\$HOME/.cargo/env\"   (fish: source \"\$HOME/.cargo/env.fish\", if that file exists)"
