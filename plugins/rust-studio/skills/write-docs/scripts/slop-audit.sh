#!/usr/bin/env bash
# Rust Code Studio — slop audit: the mechanical layer of the slop ledger as one Markdown report,
# or as a score file for /evolve.
#
# Runs what is installed, names what it skipped, and exits 0 — it reports, the reader judges.
# Every section prints the command it ran, so a line of it can be cited as evidence. A hit is
# a lead to read, not a finding: the finding is the name, the pattern or the boundary
# (rules/core.md §"Clarity is design, not size"). `slop-auditor` runs this first; /tech-debt,
# /adopt and /refactor read the report; /evolve compares two `--scores` files with
# scripts/score-compare.sh.
#
#   scripts/slop-audit.sh [-p <package>] [--path <src-dir>] [--skip clippy,deny,similarity,modules,shear,tokei] [--scores]
#
#   -p <package>   scope cargo, cargo-modules and the source path to one workspace member.
#                  A workspace with several members and no -p gets the cargo-wide passes only;
#                  cargo-modules needs one package (30 s+ per crate on a large workspace).
#   --path <dir>   the directory similarity-rs and tokei read (default: the package's src/, else .)
#   --skip <list>  comma-separated sections to leave out (clippy is the slow one).
#   --scores       print `key<TAB>value<TAB>goal` lines instead of the report; a skipped or
#                  uninstalled section prints no line, so score-compare.sh never judges it.
set -uo pipefail

pkg=""; src_path=""; skip=","; scores=0
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--package) pkg=${2:?}; shift 2 ;;
    --path) src_path=${2:?}; shift 2 ;;
    --skip) skip=",$2,"; shift 2 ;;
    --scores) scores=1; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
skipped() { [[ $skip == *",$1,"* ]]; }

have() { command -v "$1" >/dev/null 2>&1; }
have_cargo_sub() { cargo --list 2>/dev/null | grep -qE "^\s+$1(\s|$)"; }
# `timeout` keeps a stuck tool from stalling the whole report; absent (macOS), run bare.
run_to() { local secs=$1; shift; if have timeout; then timeout "$secs" "$@"; else "$@"; fi; }
strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }
test_file_re='(/tests?/|/tests?\.rs|_tests?\.rs)'

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
one_package=$(( members == 1 || ${#cargo_scope[@]} > 0 ))
# for printing: " -p name" or nothing, so a command line never carries a double space
scope_sfx="${cargo_scope[*]}"; scope_sfx=${scope_sfx:+ $scope_sfx}
# a single-crate project is named by its package, not its directory
title=$pkg
[[ -n $title ]] || title=$(cargo metadata --no-deps --format-version 1 2>/dev/null | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
[[ -n $title ]] || title=$(basename "$(pwd)")

# Each collector sets <section>_status to available | skipped | missing (or a named reason), plus
# its numbers and the detail block the report prints. Collect first, render after, so the
# Markdown report and the score file come from one run of the tools.
status_of() { # <section> <probe-kind> <probe>
  if skipped "$1"; then echo skipped
  elif [[ $2 == cargo ]]; then have_cargo_sub "$3" && echo available || echo missing
  else have "$3" && echo available || echo missing; fi
}

# --- 1. lints beyond the gate -------------------------------------------------------------------
clippy_status=$(status_of clippy cargo clippy); clippy_total=0; clippy_table=""
clippy_cmd="cargo clippy$scope_sfx --all-targets --message-format=json -- -W clippy::pedantic -W clippy::nursery -W unreachable_pub"
if [[ $clippy_status == available ]]; then
  codes=$(run_to 900 cargo clippy "${cargo_scope[@]}" --all-targets --message-format=json -- \
            -W clippy::pedantic -W clippy::nursery -W unreachable_pub 2>/dev/null \
          | grep -o '"code":{"code":"[^"]*"' | cut -d'"' -f6 | sort | uniq -c | sort -rn)
  clippy_total=$(echo "$codes" | awk '{s+=$1} END {print s+0}')
  clippy_table=$(echo "$codes" | head -20 | awk '{printf "| %s | `%s` |\n", $1, $2}')
fi

# --- 2. unused dependencies ---------------------------------------------------------------------
shear_status=$(status_of shear cargo shear); shear_count=0; shear_detail=""; shear_cmd="cargo shear$scope_sfx"
if [[ $shear_status == missing ]] && have_cargo_sub machete; then
  shear_status=available; shear_cmd="cargo machete (regex-based fallback; cargo-shear is the AST-based tool)"
  out=$(run_to 300 cargo machete 2>&1); rc=$?
  shear_count=$(echo "$out" | grep -cE '^\s+[a-zA-Z0-9_-]+$' || true); [[ $rc -eq 0 ]] && shear_count=0
  shear_detail=$(echo "$out" | tail -40)
elif [[ $shear_status == available ]]; then
  out=$(run_to 300 cargo shear "${cargo_scope[@]}" 2>&1); rc=$?
  shear_count=$(echo "$out" | grep -c 'unused dependency' || true); [[ $rc -eq 0 ]] && shear_count=0
  shear_detail=$(echo "$out" | tail -40)
fi

# --- 3. dependency policy -------------------------------------------------------------------------
deny_status=$(status_of deny cargo deny); deny_errors=0; deny_detail=""; deny_cmd="cargo deny check"
if [[ $deny_status == available && ! -f deny.toml ]]; then deny_status=no-config
elif [[ $deny_status == available ]]; then
  out=$(run_to 300 cargo deny check 2>&1); rc=$?
  deny_errors=$(echo "$out" | grep -c '^error' || true); [[ $rc -eq 0 ]] && deny_errors=0
  deny_detail=$(echo "$out" | grep -E '^(error|warning)' | head -30)
fi

# --- 4. near-duplicate functions ------------------------------------------------------------------
sim_status=$(status_of similarity bin similarity-rs); sim_src=0; sim_test=0; sim_rows=""
sim_cmd="similarity-rs $src_path --skip-test --min-lines 10 --threshold 0.9"
if [[ $sim_status == available && ! -d $src_path ]]; then sim_status=no-path
elif [[ $sim_status == available ]]; then
  out=$(run_to 600 similarity-rs "$src_path" --skip-test --min-lines 10 --threshold 0.9 2>&1)
  # one row per pair: "<similarity>  <a> <-> <b>"; `--skip-test` skips #[test] fns, not test
  # files, so pairs inside tests/, *_tests.rs or tests.rs are counted separately
  rows=$(echo "$out" | grep -B1 'Similarity:' | grep -v '^--$' | paste - - | sed 's/  */ /g' \
      | awk -F'Similarity: ' '{print $2 "  " $1}' | sort -rn)
  sim_test=$(echo "$rows" | grep -E "$test_file_re" | grep -c . || true)
  sim_src=$(echo "$rows" | grep -vE "$test_file_re" | grep -c . || true)
  sim_rows=$(echo "$rows" | grep -vE "$test_file_re" | head -15)
fi

# --- 5. module graph ------------------------------------------------------------------------------
mod_status=$(status_of modules cargo modules); orphans=0; cycles=0; orphan_detail=""; cycle_detail=""; structure=""
if [[ $mod_status == available && $one_package -eq 0 ]]; then mod_status=no-package
elif [[ $mod_status == available ]]; then
  out=$(run_to 300 cargo modules orphans "${cargo_scope[@]}" --lib --cfg-test 2>&1); rc=$?
  if [[ $rc -ne 0 ]]; then
    orphans=$(echo "$out" | strip_ansi | grep -c 'orphaned module' || true)
    orphan_detail=$(echo "$out" | strip_ansi | grep -E 'orphan|\.rs' | head -20)
  fi
  cycle_detail=$(run_to 300 cargo modules dependencies "${cargo_scope[@]}" --lib --no-fns --no-externs --no-sysroot 2>/dev/null \
    | grep -o '"[^"]*" -> "[^"]*" \[label="uses"' | sed -E 's/"([^"]+)" -> "([^"]+)".*/\1 \2/' \
    | awk '{ if (($2" "$1) in seen) print "cycle: " $1 " <-> " $2; seen[$1" "$2]=1 }')
  cycles=$(echo "$cycle_detail" | grep -c . || true)
  structure=$(run_to 300 cargo modules structure "${cargo_scope[@]}" --lib --max-depth 2 --no-fns --no-types --no-traits 2>/dev/null | strip_ansi | head -60)
fi

# --- 6. size (a lead, never a finding) --------------------------------------------------------------
tokei_status=$(status_of tokei bin tokei); code_lines=0; largest=""; largest_lines=0; tokei_summary=""
if [[ $tokei_status == available ]]; then
  tokei_summary=$(run_to 120 tokei "$src_path" -t Rust 2>/dev/null | sed -n '1,6p')
  code_lines=$(run_to 120 tokei "$src_path" -t Rust -o json 2>/dev/null | grep -o '"Rust":{"blanks":[0-9]*,"code":[0-9]*' | grep -o '[0-9]*$')
  largest=$(run_to 120 tokei "$src_path" -t Rust -f 2>/dev/null | grep -E '\.rs' | sort -k3 -rn | head -10 | awk '{print $3 "  " $1}')
  largest_lines=$(echo "$largest" | head -1 | awk '{print $1+0}')
fi

# --- render: scores -----------------------------------------------------------------------------------
if (( scores )); then
  [[ $clippy_status == available ]] && printf 'warnings_beyond_gate\t%s\tmin\n' "$clippy_total"
  [[ $shear_status == available ]]  && printf 'unused_dependencies\t%s\tmin\n' "$shear_count"
  [[ $deny_status == available ]]   && printf 'deny_errors\t%s\tmin\n' "$deny_errors"
  [[ $sim_status == available ]]    && printf 'duplicate_pairs_src\t%s\tmin\nduplicate_pairs_test\t%s\tinfo\n' "$sim_src" "$sim_test"
  [[ $mod_status == available ]]    && printf 'orphan_files\t%s\tmin\nmodule_cycles\t%s\tmin\n' "$orphans" "$cycles"
  [[ $tokei_status == available ]]  && printf 'rust_code_lines\t%s\tinfo\nlargest_file_lines\t%s\tinfo\n' "${code_lines:-0}" "$largest_lines"
  exit 0
fi

# --- render: Markdown ---------------------------------------------------------------------------------
status_text() { case $1 in available) echo available ;; skipped) echo "skipped (--skip)" ;; missing) echo "not installed" ;; *) echo "$1" ;; esac; }
echo "# Slop audit — $title — $(date -u +%Y-%m-%d)"
echo
echo "Scope: \`$(pwd)\`${pkg:+, package \`$pkg\`}; source path \`$src_path\`; $members workspace member(s)."
echo
echo "| Tool | Status |"
echo "|---|---|"
echo "| \`cargo clippy\` | $(status_text "$clippy_status") |"
echo "| \`cargo shear\` | $(status_text "$shear_status") |"
echo "| \`cargo deny\` | $(status_text "$deny_status") |"
echo "| \`similarity-rs\` | $(status_text "$sim_status") |"
echo "| \`cargo modules\` | $(status_text "$mod_status") |"
echo "| \`tokei\` | $(status_text "$tokei_status") |"
echo

echo "## Lints beyond the project gate (one-off probe, not a gate edit)"; echo
case $clippy_status in
  skipped) echo "_skipped_" ;;
  missing) echo "_clippy not installed (\`rustup component add clippy\`)_" ;;
  *) echo "\`$clippy_cmd\`"; echo
     if [[ $clippy_total -eq 0 ]]; then echo "No warnings beyond the gate."
     else
       echo "$clippy_total warning(s); by lint (top 20):"; echo
       echo "| count | lint |"; echo "|---|---|"; echo "$clippy_table"; echo
       echo "\`must_use_candidate\`, \`missing_errors_doc\` and \`module_name_repetitions\` are style;"
       echo "\`unreachable_pub\`, \`needless_pass_by_value\`, \`too_many_lines\`, \`cognitive_complexity\` are leads."
     fi ;;
esac
echo

echo "## Unused dependencies"; echo
case $shear_status in
  skipped) echo "_skipped_" ;;
  missing) echo "_cargo-shear not installed (\`cargo binstall cargo-shear\`)_" ;;
  *) echo "\`$shear_cmd\`"; echo
     if [[ $shear_count -eq 0 ]]; then echo "None (exit 0)."; else echo '```'; echo "$shear_detail"; echo '```'; fi ;;
esac
echo

echo "## Dependency policy (advisories, bans, licenses, sources)"; echo
case $deny_status in
  skipped) echo "_skipped_" ;;
  missing) echo "_cargo-deny not installed (\`cargo binstall cargo-deny\`)_" ;;
  no-config) echo "_no deny.toml — \`/ci-gate\` carries the template_" ;;
  *) echo "\`$deny_cmd\`"; echo
     if [[ $deny_errors -eq 0 ]]; then echo "Clean (exit 0)."; else echo "$deny_errors error(s):"; echo '```'; echo "$deny_detail"; echo '```'; fi ;;
esac
echo

echo "## Near-duplicate functions (AST similarity)"; echo
case $sim_status in
  skipped) echo "_skipped_" ;;
  missing) echo "_similarity-rs not installed (\`cargo binstall similarity-rs\`)_" ;;
  no-path) echo "_source path \`$src_path\` does not exist_" ;;
  *) echo "\`$sim_cmd\` (the defaults flag every three-line trait impl; widen only after this pass is triaged)"; echo
     if [[ $sim_src -eq 0 ]]; then echo "No pairs outside test files ($sim_test in test files)."
     else
       echo "$sim_src pair(s) outside test files ($sim_test more in test files). First 15, highest similarity first:"; echo
       echo '```'; echo "$sim_rows"; echo '```'
     fi ;;
esac
echo

echo "## Module graph (orphans, cycles, structure)"; echo
case $mod_status in
  skipped) echo "_skipped_" ;;
  missing) echo "_cargo-modules not installed (\`cargo binstall cargo-modules\`)_" ;;
  no-package) echo "_$members workspace members and no \`-p\` — pass one package; each crate takes 30 s+_" ;;
  *) echo "\`cargo modules orphans$scope_sfx --lib --cfg-test\`"; echo
     if [[ $orphans -eq 0 ]]; then echo "No orphan files."; else echo '```'; echo "$orphan_detail"; echo '```'; fi
     echo
     echo "\`cargo modules dependencies$scope_sfx --lib --no-fns --no-externs --no-sysroot\` → \`uses\` edges in both directions"; echo
     if [[ $cycles -eq 0 ]]; then echo "No module cycles."
     else echo "$cycles pair(s) — a parent ↔ child pair is usually a re-export; sibling ↔ sibling is the finding, and a clique is one \`use super::*\` per file:"; echo; echo '```'; echo "$cycle_detail" | head -30; echo '```'; fi
     echo
     echo "\`cargo modules structure$scope_sfx --lib --max-depth 2 --no-fns --no-types --no-traits\`"; echo
     echo '```'; echo "$structure"; echo '```' ;;
esac
echo

echo "## Size (where to look — not what is wrong)"; echo
case $tokei_status in
  skipped) echo "_skipped_" ;;
  missing) echo "_tokei not installed (\`cargo binstall tokei\`)_" ;;
  *) echo "\`tokei $src_path -t Rust\`"; echo; echo '```'; echo "$tokei_summary"; echo '```'
     echo; echo "Largest files:"; echo; echo '```'; echo "$largest"; echo '```' ;;
esac
echo
echo "## Read next"
echo
echo "Each hit above is a lead. Read both sides of a duplicate before calling it one; name the pattern"
echo "a drifted shape reaches for; a long function with one job and a name that states it is not a"
echo "finding (\`rules/core.md\` §\"Clarity is design, not size\", \`rules/types.md\` §\"Design-drift tells\")."
