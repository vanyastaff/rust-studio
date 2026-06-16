#!/usr/bin/env bash
# check-gate.sh — assert the anti-hang gate has not been quietly weakened.
#
# This is the mechanical answer to "the agent edits clippy.toml / adds #[allow] instead of fixing
# the code." It fails (exit 1) if a required ban, the no-silent-allow lint, or the test timeout
# has been removed. Run it in lefthook (pre-push) AND in CI (from the committed tree), so weakening
# the gate is a loud, review-gated, multi-file change — not a silent one-liner.
#
# It cannot stop someone editing THIS script too — pair it with CODEOWNERS / required review on the
# gate paths (clippy.toml, Cargo.toml, .config/nextest.toml, lefthook.yml, .github/, this script).
set -uo pipefail
fail=0
note() { echo "check-gate: $1"; fail=1; }

has() { [ -f "$1" ] && grep -Eq "$2" "$1"; }

# 1) clippy.toml must still ban the nondeterminism / thread-blocking footguns.
for m in 'SystemTime::now' 'Instant::now' 'thread::sleep'; do
  has clippy.toml "$m" || note "clippy.toml no longer bans '$m' — fix the call site, don't drop the ban"
done

# 2) No-silent-allow must stay on (else an agent can #[allow] its way past any lint).
grep -Rqs 'allow_attributes_without_reason' --include='Cargo.toml' . \
  || note "lost 'allow_attributes_without_reason' — silent #[allow] is now possible"

# 3) The test timeout must stay, or a deadlock can stall CI again.
has .config/nextest.toml 'terminate-after' \
  || note ".config/nextest.toml lost 'terminate-after' — a hang can stall the run again"

if [ "$fail" -ne 0 ]; then
  echo "check-gate: the CI-hang gate was weakened. Restore it or get an explicit human review of the gate change." >&2
  exit 1
fi
echo "check-gate: gate intact"
