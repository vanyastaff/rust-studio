#!/usr/bin/env bash
set -uo pipefail
fail() { echo "CHECK FAIL: $*"; exit 1; }
# Every rule below reads `git diff HEAD`, which exits non-zero for a real change AND for a
# broken baseline. Without this guard the two failure modes diverge: the `--quiet` rules fail
# with a wrong reason, while the anti-gaming greps see an empty diff and PASS silently — the
# one direction a benchmark must never fail in. The runner always commits a baseline; a hand
# run (docs: cp the crate, git init, git commit) has to as well.
git rev-parse --verify HEAD >/dev/null 2>&1 || fail "no git baseline in $PWD — run: git init -q && git add -A && git commit -qm base"
git add -N src 2>/dev/null   # intent-to-add: a NEW file under src/ shows up in the diff too
git diff HEAD -- src | grep -nE '^\+.*(\.clone\(\)|#\[allow\(|\bunsafe\b|transmute|\.unwrap\(\))' && fail "masking construct added"
# Adding a test is allowed (the task says do not weaken or delete); a removed or rewritten
# assertion / #[test] line is the edit this guards against.
git diff HEAD -- src/lib.rs | grep -nE '^-\s*(#\[test\]|assert)' && fail "existing tests were edited or removed"
git diff --quiet HEAD -- Cargo.toml || fail "Cargo.toml edited"
echo "== gate"
cargo build 2>&1 | tail -1 || true
cargo build >/dev/null 2>&1 || fail "cargo build"
cargo clippy --all-targets -- -D warnings >/dev/null 2>&1 || fail "clippy -D warnings"
out=$(cargo test 2>&1) || { echo "$out" | tail -20; fail "cargo test"; }
echo "$out" | grep 'test result' | head -1
cargo fmt --check || fail "cargo fmt --check"
echo "CHECK PASS: red build is green without masking; tests untouched"
