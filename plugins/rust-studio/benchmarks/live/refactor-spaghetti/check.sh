#!/usr/bin/env bash
set -uo pipefail
fail() { echo "CHECK FAIL: $*"; exit 1; }
grep -nE '#\[allow\(' src/lib.rs && fail "#[allow] in src/lib.rs"
sig=$(sed -n '/^pub fn apply_discount(/,/^) -> /p' src/lib.rs | tr -d ' \n')
[[ "$sig" == 'pubfnapply_discount(order:&mutOrder,kind:&str,code:&str,amount:u64,vip:bool,retry:bool,dry:bool,)->Result<u64,String>{'* ]] || fail "public signature of apply_discount changed: $sig"
grep -q 'pub subtotal_cents: u64' src/lib.rs && grep -q 'pub items: Vec<(String, u32)>' src/lib.rs && grep -q 'pub coupon_uses: HashMap<String, u32>' src/lib.rs || fail "Order fields changed"
echo "== gate"
cargo fmt --check || fail "cargo fmt --check"
cargo clippy --all-targets -- -D warnings >/dev/null 2>&1 || fail "clippy -D warnings"
out=$(cargo test 2>&1) || { echo "$out" | tail -20; fail "cargo test"; }
echo "$out" | grep 'test result'
tests=$(grep -rhoE '#\[test\]' src tests 2>/dev/null | wc -l)
(( tests >= 10 )) || fail "expected >= 10 tests (characterization tests pin the behavior), got $tests"
echo "== golden harness ($(wc -l < "$LIVE_DIR/golden-baseline.txt") rows)"
mkdir -p examples && cp "$LIVE_DIR/golden.rs" examples/golden.rs
cargo run -q --example golden 2>/dev/null | sort > /tmp/golden-after.$$ ; rm -rf examples
diff <(sort "$LIVE_DIR/golden-baseline.txt") /tmp/golden-after.$$ > /tmp/golden-diff.$$ || { head -10 /tmp/golden-diff.$$; fail "behavior changed: golden output differs"; }
echo "CHECK PASS: gate green, $tests tests, public surface unchanged, golden identical"
