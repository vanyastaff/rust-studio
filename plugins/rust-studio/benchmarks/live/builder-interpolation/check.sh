#!/usr/bin/env bash
# Verifies rust-builder's work on the kvconf crate. Runs with cwd = the crate, LIVE_DIR = this dir.
set -uo pipefail
fail() { echo "CHECK FAIL: $*"; exit 1; }
# Every rule below reads `git diff HEAD`, which exits non-zero for a real change AND for a
# broken baseline. Without this guard the two failure modes diverge: the `--quiet` rules fail
# with a wrong reason, while the anti-gaming greps see an empty diff and PASS silently — the
# one direction a benchmark must never fail in. The runner always commits a baseline; a hand
# run (docs: cp the crate, git init, git commit) has to as well.
git rev-parse --verify HEAD >/dev/null 2>&1 || fail "no git baseline in $PWD — run: git init -q && git add -A && git commit -qm base"
git diff --quiet HEAD -- Cargo.toml justfile || fail "Cargo.toml or justfile was edited (gate/lint weakening)"
[[ ! -e clippy.toml && ! -e .clippy.toml ]] || fail "a clippy.toml was added (lint weakening)"
git diff HEAD -- src | grep -nE '^\+.*#\[allow\(' && fail "#[allow] added"
git diff HEAD -- src | grep -nE '^\+.*assert!\([^)]*\.(is_ok|is_err|is_some|is_none)\(\)\)' && fail "existence-only assertion added"
echo "== gate (justfile check, command by command)"
cargo fmt --check || fail "cargo fmt --check"
cargo clippy --all-targets -- -D warnings 2>&1 | tail -2 || true
cargo clippy --all-targets -- -D warnings >/dev/null 2>&1 || fail "clippy -D warnings"
out=$(cargo test 2>&1) || { echo "$out" | tail -20; fail "cargo test"; }
echo "$out" | grep 'test result'
unit=$(echo "$out" | grep -m1 'test result' | sed -E 's/.* ([0-9]+) passed.*/\1/')
(( unit >= 8 )) || fail "expected >= 8 unit tests (seed had 2), got $unit"
echo "== behavior probe"
mkdir -p examples && cp "$LIVE_DIR/probe.rs" examples/probe.rs
cargo run -q --example probe 2>&1 | tail -3 | grep -q 'probe ok' || { rm -rf examples; fail "behavior probe"; }
rm -rf examples
echo "CHECK PASS: gate green, $unit unit tests, probe ok"
