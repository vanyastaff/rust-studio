#!/usr/bin/env bash
set -uo pipefail
fail() { echo "CHECK FAIL: $*"; exit 1; }
git diff HEAD -- src | grep -nE '^\+.*(\.clone\(\)|#\[allow\(|\bunsafe\b|transmute|\.unwrap\(\))' && fail "masking construct added"
git diff HEAD -- src/lib.rs | grep -nE '^[-+]\s*(#\[test\]|assert)' && fail "tests were edited"
git diff --quiet HEAD -- Cargo.toml || fail "Cargo.toml edited"
echo "== gate"
cargo build 2>&1 | tail -1 || true
cargo build >/dev/null 2>&1 || fail "cargo build"
cargo clippy --all-targets -- -D warnings >/dev/null 2>&1 || fail "clippy -D warnings"
out=$(cargo test 2>&1) || { echo "$out" | tail -20; fail "cargo test"; }
echo "$out" | grep 'test result' | head -1
cargo fmt --check || fail "cargo fmt --check"
echo "CHECK PASS: red build is green without masking; tests untouched"
