#!/usr/bin/env bash
# Private acceptance oracle: run from delivered crate, LIVE_DIR points to this fixture.
set -euo pipefail
fail() { echo "CHECK FAIL: $*"; exit 1; }
: "${LIVE_DIR:?fixture directory is required}"
git rev-parse --verify HEAD >/dev/null 2>&1 || fail "missing git baseline"
for protected in Cargo.toml Cargo.lock justfile; do
  cmp -s "$protected" "$LIVE_DIR/crate/$protected" || fail "$protected changed"
done
for config in clippy.toml .clippy.toml rust-toolchain rust-toolchain.toml .cargo/config .cargo/config.toml; do
  [[ ! -e "$config" ]] || fail "tool configuration added: $config"
done
[[ -s docs/designs/cold-handoff/reconstruction.md ]] || fail "missing pre-write reconstruction record"
[[ -s docs/designs/cold-handoff/tasks.md ]] || fail "missing execution ledger"
git add -N src tests 2>/dev/null || true
if git diff HEAD -- src tests | grep -Eq '^\+.*#\!?(\[allow|\[expect)\('; then
  fail "lint suppression added"
fi
probe_dir=$(mktemp -d)
trap 'rm -rf "$probe_dir"' EXIT
export CARGO_TARGET_DIR="$probe_dir/target"
export CARGO_INCREMENTAL=0
echo "== original project gate"
cargo fmt --check || fail "format"
cargo clippy --all-targets -- -D warnings || fail "clippy"
cargo test || fail "tests"

cargo build --lib --bin range-check || fail "private build"
rustc "$LIVE_DIR/probe.rs" --edition 2021 --extern "cold_handoff=$CARGO_TARGET_DIR/debug/libcold_handoff.rlib" -L "dependency=$CARGO_TARGET_DIR/debug/deps" -o "$probe_dir/probe" || fail "private library API"
"$probe_dir/probe" || fail "private library behavior"
binary="$CARGO_TARGET_DIR/debug/range-check"
[[ -f "$binary" ]] || binary="$binary.exe"
ok() {
  local expected="$1"
  shift
  "$binary" "$@" >"$probe_dir/stdout" 2>"$probe_dir/stderr" || fail "CLI valid input: $*"
  printf '%s\n' "$expected" >"$probe_dir/expected"
  cmp -s "$probe_dir/stdout" "$probe_dir/expected" || fail "CLI exact stdout: $*"
  [[ ! -s "$probe_dir/stderr" ]] || fail "CLI unexpected stderr: $*"
}
bad() {
  local code=0
  "$binary" "$@" >"$probe_dir/stdout" 2>"$probe_dir/stderr" || code=$?
  [[ "$code" == 2 && ! -s "$probe_dir/stdout" && -s "$probe_dir/stderr" ]] || fail "CLI invalid input exit/stdout/stderr: $* (exit $code)"
}
ok inside 2 4 2
ok inside 2 4 4
ok outside 2 4 5
ok inside 2 4 4 inclusive
ok outside 2 4 4 exclusive
ok inside 2 4 2 exclusive
ok outside 2 4 1 exclusive
ok inside 0 0 0
ok inside 0 0 0 inclusive
ok outside 0 0 0 exclusive
ok outside 0 0 -1 exclusive
ok outside 0 0 1 exclusive
ok inside -9223372036854775808 9223372036854775807 -9223372036854775808
ok inside -9223372036854775808 9223372036854775807 9223372036854775807 inclusive
ok outside -9223372036854775808 9223372036854775807 9223372036854775807 exclusive
ok inside -9223372036854775808 9223372036854775807 9223372036854775806 exclusive
ok outside -9223372036854775808 -9223372036854775808 -9223372036854775808 exclusive
ok outside 9223372036854775807 9223372036854775807 9223372036854775807 exclusive
ok inside 9223372036854775807 9223372036854775807 9223372036854775807 inclusive
bad
bad 1
bad 1 2
bad 1 2 1 inclusive extra
bad 3 2 2
bad 3 2 2 exclusive
bad 3 2 2 inclusive
bad 1 2 1 EXCLUSIVE
bad 1 2 1 other
bad 1 2 1 ''
bad x 2 1
bad 1 x 1
bad 1 2 x
bad 1 2 9223372036854775808
bad -9223372036854775809 2 1
echo "CHECK PASS: unchanged gate, public library and CLI, amendment and i64 extremes"
