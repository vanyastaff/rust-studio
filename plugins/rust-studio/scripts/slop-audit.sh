#!/usr/bin/env bash
# Rust Code Studio — slop audit: the mechanical layer of the slop ledger as one Markdown report.
#
# Runs what is installed, names what it skipped, and exits 0 — it reports, the reader judges.
# Every section prints the command it ran, so a line of it can be cited as evidence. A hit is
# a lead to read, not a finding: the finding is the name, the pattern or the boundary
# (rules/core.md §"Clarity is design, not size"). `slop-auditor` runs this first; /tech-debt,
# /adopt and /refactor read the report.
#
#   scripts/slop-audit.sh [-p <package>] [--path <src-dir>] [--skip clippy,deny,similarity,modules,shear,tokei]
#
#   -p <package>   scope cargo, cargo-modules and the source path to one workspace member.
#                  A workspace with several members and no -p gets the cargo-wide passes only;
#                  cargo-modules needs one package (30 s+ per crate on a large workspace).
#   --path <dir>   the directory similarity-rs and tokei read (default: the package's src/, else .)
#   --skip <list>  comma-separated sections to leave out (clippy is the slow one).
set -uo pipefail

pkg=""; src_path=""; skip=","
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--package) pkg=${2:?}; shift 2 ;;
    --path) src_path=${2:?}; shift 2 ;;
    --skip) skip=",$2,"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
skipped() { [[ $skip == *",$1,"* ]]; }

have() { command -v "$1" >/dev/null 2>&1; }
have_cargo_sub() { cargo --list 2>/dev/null | grep -qE "^\s+$1(\s|$)"; }
# `timeout` keeps a stuck tool from stalling the whole report; absent (macOS), run bare.
run_to() { local secs=$1; shift; if have timeout; then timeout "$secs" "$@"; else "$@"; fi; }

# --- scope ------------------------------------------------------------------------------------
if ! [[ -f Cargo.toml ]]; then
  echo "slop-audit: no Cargo.toml in $(pwd) — run from the crate or workspace root" >&2; exit 2
fi
members=$(cargo metadata --no-deps --format-version 1 2>/dev/null | grep -o '"manifest_path":"[^"]*"' | wc -l)
if [[ -n $pkg ]]; then
  # `cargo pkgid` prints `path+file:///abs/dir#name@version` for a workspace member
  pkgid=$(cargo pkgid -p "$pkg" 2>/dev/null) || { echo "slop-audit: package '$pkg' is not a workspace member" >&2; exit 2; }
  pkg_dir=${pkgid#path+file://}; pkg_dir=${pkg_dir%%#*}
  pkg_dir=${pkg_dir#"$(pwd -P)/"}   # relative to the root where that is possible (symlinked roots resolve)
  [[ -n $src_path ]] || src_path="$pkg_dir/src"
  cargo_scope=(-p "$pkg")
else
  [[ -n $src_path ]] || src_path=.
  cargo_scope=()
fi
modules_scope=()
if [[ -n $pkg ]]; then modules_scope=(-p "$pkg"); fi
one_package=$(( members == 1 || ${#modules_scope[@]} > 0 ))
# for printing: " -p name" or nothing, so a command line never carries a double space
scope_sfx="${cargo_scope[*]}"; scope_sfx=${scope_sfx:+ $scope_sfx}
# a single-crate project is named by its package, not its directory
title=$pkg
[[ -n $title ]] || title=$(cargo metadata --no-deps --format-version 1 2>/dev/null | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
[[ -n $title ]] || title=$(basename "$(pwd)")

echo "# Slop audit — $title — $(date -u +%Y-%m-%d)"
echo
echo "Scope: \`$(pwd)\`${pkg:+, package \`$pkg\`}; source path \`$src_path\`; $members workspace member(s)."
echo
echo "| Tool | Status |"
echo "|---|---|"
for t in "clippy:cargo clippy" "shear:cargo shear" "deny:cargo deny" "similarity:similarity-rs" "modules:cargo modules" "tokei:tokei"; do
  key=${t%%:*}; cmd=${t#*:}
  if skipped "$key"; then st="skipped (--skip)"
  elif [[ $cmd == cargo\ * ]]; then have_cargo_sub "${cmd#cargo }" && st="available" || st="not installed"
  else have "$cmd" && st="available" || st="not installed"; fi
  echo "| \`$cmd\` | $st |"
done
echo

# --- 1. lints beyond the gate -------------------------------------------------------------------
echo "## Lints beyond the project gate (one-off probe, not a gate edit)"
echo
if skipped clippy; then echo "_skipped_"
elif ! have_cargo_sub clippy; then echo "_clippy not installed (\`rustup component add clippy\`)_"
else
  cmd="cargo clippy$scope_sfx --all-targets --message-format=json -- -W clippy::pedantic -W clippy::nursery -W unreachable_pub"
  echo "\`$cmd\`"; echo
  codes=$(run_to 900 cargo clippy "${cargo_scope[@]}" --all-targets --message-format=json -- \
            -W clippy::pedantic -W clippy::nursery -W unreachable_pub 2>/dev/null \
          | grep -o '"code":{"code":"[^"]*"' | cut -d'"' -f6 | sort | uniq -c | sort -rn)
  if [[ -z $codes ]]; then echo "No warnings beyond the gate."
  else
    total=$(echo "$codes" | awk '{s+=$1} END {print s}')
    echo "$total warning(s); by lint (top 20):"; echo
    echo "| count | lint |"; echo "|---|---|"
    echo "$codes" | head -20 | awk '{printf "| %s | `%s` |\n", $1, $2}'
    echo; echo "\`must_use_candidate\`, \`missing_errors_doc\` and \`module_name_repetitions\` are style;"
    echo "\`unreachable_pub\`, \`needless_pass_by_value\`, \`too_many_lines\`, \`cognitive_complexity\` are leads."
  fi
fi
echo

# --- 2. unused dependencies ---------------------------------------------------------------------
echo "## Unused dependencies"
echo
if skipped shear; then echo "_skipped_"
elif have_cargo_sub shear; then
  echo "\`cargo shear$scope_sfx\`"; echo
  out=$(run_to 300 cargo shear "${cargo_scope[@]}" 2>&1); rc=$?
  if [[ $rc -eq 0 ]]; then echo "None (exit 0)."; else echo '```'; echo "$out" | tail -40; echo '```'; fi
elif have_cargo_sub machete; then
  echo "\`cargo machete\` (regex-based fallback; cargo-shear is the AST-based tool)"; echo
  echo '```'; run_to 300 cargo machete 2>&1 | tail -40; echo '```'
else echo "_cargo-shear not installed (\`cargo binstall cargo-shear\`)_"; fi
echo

# --- 3. dependency policy -------------------------------------------------------------------------
echo "## Dependency policy (advisories, bans, licenses, sources)"
echo
if skipped deny; then echo "_skipped_"
elif ! have_cargo_sub deny; then echo "_cargo-deny not installed (\`cargo binstall cargo-deny\`)_"
elif ! [[ -f deny.toml ]]; then echo "_no deny.toml — \`/ci-gate\` carries the template_"
else
  echo "\`cargo deny check\`"; echo
  out=$(run_to 300 cargo deny check 2>&1); rc=$?
  errs=$(echo "$out" | grep -c '^error' || true)
  if [[ $rc -eq 0 ]]; then echo "Clean (exit 0)."; else echo "$errs error(s), exit $rc:"; echo '```'; echo "$out" | grep -E '^(error|warning)' | head -30; echo '```'; fi
fi
echo

# --- 4. near-duplicate functions ------------------------------------------------------------------
echo "## Near-duplicate functions (AST similarity)"
echo
if skipped similarity; then echo "_skipped_"
elif ! have similarity-rs; then echo "_similarity-rs not installed (\`cargo binstall similarity-rs\`)_"
elif ! [[ -d $src_path ]]; then echo "_source path \`$src_path\` does not exist_"
else
  cmd="similarity-rs $src_path --skip-test --min-lines 10 --threshold 0.9"
  echo "\`$cmd\` (the defaults flag every three-line trait impl; widen only after this pass is triaged)"; echo
  out=$(run_to 600 similarity-rs "$src_path" --skip-test --min-lines 10 --threshold 0.9 2>&1)
  # one row per pair: "<similarity>  <a> <-> <b>"; `--skip-test` skips #[test] fns, not test
  # files, so pairs inside tests/, *_tests.rs or tests.rs are counted separately below
  rows=$(echo "$out" | grep -B1 'Similarity:' | grep -v '^--$' | paste - - | sed 's/  */ /g' \
      | awk -F'Similarity: ' '{print $2 "  " $1}' | sort -rn)
  test_rows=$(echo "$rows" | grep -E '(/tests?/|/tests?\.rs|_tests?\.rs)' | grep -c . || true)
  src_rows=$(echo "$rows" | grep -vE '(/tests?/|/tests?\.rs|_tests?\.rs)' | grep -c . || true)
  if [[ ${src_rows:-0} -eq 0 ]]; then echo "No pairs outside test files (${test_rows:-0} in test files)."
  else
    echo "$src_rows pair(s) outside test files (${test_rows:-0} more in test files). First 15, highest similarity first:"; echo
    echo '```'
    echo "$rows" | grep -vE '(/tests?/|/tests?\.rs|_tests?\.rs)' | head -15
    echo '```'
  fi
fi
echo

# --- 5. module graph ------------------------------------------------------------------------------
echo "## Module graph (orphans, cycles, structure)"
echo
if skipped modules; then echo "_skipped_"
elif ! have_cargo_sub modules; then echo "_cargo-modules not installed (\`cargo binstall cargo-modules\`)_"
elif [[ $one_package -eq 0 ]]; then echo "_$members workspace members and no \`-p\` — pass one package; each crate takes 30 s+_"
else
  echo "\`cargo modules orphans$scope_sfx --lib --cfg-test\`"; echo
  out=$(run_to 300 cargo modules orphans "${modules_scope[@]}" --lib --cfg-test 2>&1); rc=$?
  if [[ $rc -eq 0 ]]; then echo "No orphan files."
  else echo '```'; echo "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'orphan|\.rs' | head -20; echo '```'; fi
  echo
  echo "\`cargo modules dependencies$scope_sfx --lib --no-fns --no-externs --no-sysroot\` → \`uses\` edges in both directions"; echo
  cycles=$(run_to 300 cargo modules dependencies "${modules_scope[@]}" --lib --no-fns --no-externs --no-sysroot 2>/dev/null \
    | grep -o '"[^"]*" -> "[^"]*" \[label="uses"' | sed -E 's/"([^"]+)" -> "([^"]+)".*/\1 \2/' \
    | awk '{ if (($2" "$1) in seen) print "cycle: " $1 " <-> " $2; seen[$1" "$2]=1 }')
  if [[ -z $cycles ]]; then echo "No module cycles."
  else echo "$(echo "$cycles" | wc -l) pair(s) — a parent ↔ child pair is usually a re-export; sibling ↔ sibling is the finding:"; echo; echo '```'; echo "$cycles" | head -30; echo '```'; fi
  echo
  echo "\`cargo modules structure$scope_sfx --lib --max-depth 2 --no-fns --no-types --no-traits\`"; echo
  echo '```'; run_to 300 cargo modules structure "${modules_scope[@]}" --lib --max-depth 2 --no-fns --no-types --no-traits 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | head -60; echo '```'
fi
echo

# --- 6. size (a lead, never a finding) --------------------------------------------------------------
echo "## Size (where to look — not what is wrong)"
echo
if skipped tokei; then echo "_skipped_"
elif ! have tokei; then echo "_tokei not installed (\`cargo binstall tokei\`)_"
else
  echo "\`tokei $src_path -t Rust\`"; echo; echo '```'
  run_to 120 tokei "$src_path" -t Rust 2>/dev/null | sed -n '1,6p'
  echo '```'
  echo; echo "Largest files:"; echo; echo '```'
  run_to 120 tokei "$src_path" -t Rust -f 2>/dev/null | grep -E '\.rs' | sort -k3 -rn | head -10 | awk '{print $3 "  " $1}'
  echo '```'
fi
echo
echo "## Read next"
echo
echo "Each hit above is a lead. Read both sides of a duplicate before calling it one; name the pattern"
echo "a drifted shape reaches for; a long function with one job and a name that states it is not a"
echo "finding (\`rules/core.md\` §\"Clarity is design, not size\", \`rules/types.md\` §\"Design-drift tells\")."
