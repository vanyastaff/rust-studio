#!/usr/bin/env bash
# Rust Code Studio — score compare: the deterministic half of "did it get better?".
#
# A score file is one metric per line, tab-separated: `<key>\t<value>\t<goal>`, where goal is
# `min` (lower is better), `max` (higher is better) or `info` (recorded, never judged).
# `scripts/slop-audit.sh --scores` writes one for a Rust crate; `tools/harness-score.ts` writes
# one for the plugin itself. /evolve compares the round's file against the checkpoint's.
#
#   scripts/score-compare.sh <before> <after>
#   scripts/score-compare.sh --table <file>...       a Markdown scoreboard: one column per file
#                                                    (its basename), best judged value in bold
#
# The two-file form prints one row per metric and a verdict line, and exits:
#   0  IMPROVED: <keys>      at least one judged metric moved the right way, none the wrong way
#   0  NO CHANGE             every judged metric is equal
#   1  REGRESSION: <keys>    a judged metric moved the wrong way (whatever else improved)
#   2  usage or a malformed line
# A key present on one side only is reported as `new`/`gone` and never judged: a metric that
# appears mid-run is a contract change, not an improvement.
set -uo pipefail

if [[ ${1:-} == -h || ${1:-} == --help ]]; then sed -n '2,19p' "$0"; exit 0; fi

if [[ ${1:-} == --table ]]; then
  shift
  [[ $# -ge 1 ]] || { echo "usage: score-compare.sh --table <file>..." >&2; exit 2; }
  for f in "$@"; do [[ -f $f ]] || { echo "score-compare.sh: no such file: $f" >&2; exit 2; }; done
  awk -F'\t' '
    function label(path,  n, parts) { n = split(path, parts, "/"); sub(/\.[a-z]+$/, "", parts[n]); return parts[n] }
    FNR == 1 { col++; name[col] = label(FILENAME) }
    /^[[:space:]]*(#|$)/ { next }
    NF == 3 { if (!($1 in seen)) { order[++n] = $1; seen[$1] = 1 }; v[$1, col] = $2; goal[$1] = $3 }
    END {
      printf "| metric |"; for (c = 1; c <= col; c++) printf " %s |", name[c]; print ""
      printf "|---|"; for (c = 1; c <= col; c++) printf "---:|"; print ""
      for (i = 1; i <= n; i++) {
        k = order[i]; best = ""
        if (goal[k] != "info") for (c = 1; c <= col; c++) if ((k, c) in v) {
          if (best == "" || (goal[k] == "min" && v[k, c] + 0 < best + 0) || (goal[k] == "max" && v[k, c] + 0 > best + 0)) best = v[k, c]
        }
        printf "| %s |", k
        for (c = 1; c <= col; c++) {
          if (!((k, c) in v)) printf " - |"
          else if (best != "" && v[k, c] + 0 == best + 0) printf " **%s** |", v[k, c]
          else printf " %s |", v[k, c]
        }
        print ""
      }
    }
  ' "$@"
  exit 0
fi

[[ $# -eq 2 && -f $1 && -f $2 ]] || { echo "usage: score-compare.sh <before> <after> | --table <file>..." >&2; exit 2; }
before=$1; after=$2

awk -F'\t' -v OFS='\t' '
  function bad(file, line) { printf "malformed line in %s: %s\n", file, line > "/dev/stderr"; malformed = 1 }
  function isnum(v) { return v ~ /^-?[0-9]+(\.[0-9]+)?$/ }
  FNR == 1 { side++ }
  /^[[:space:]]*(#|$)/ { next }
  {
    if (NF != 3 || !isnum($2) || ($3 != "min" && $3 != "max" && $3 != "info")) { bad(FILENAME, $0); next }
    if (side == 1) { b[$1] = $2; goal[$1] = $3; if (!($1 in seen)) { order[++n] = $1; seen[$1] = 1 } }
    else           { a[$1] = $2; goal[$1] = $3; if (!($1 in seen)) { order[++n] = $1; seen[$1] = 1 } }
  }
  END {
    if (malformed) exit 2
    printf "%-28s %12s %12s  %s\n", "metric", "before", "after", "verdict"
    for (i = 1; i <= n; i++) {
      k = order[i]
      if (!(k in b)) { printf "%-28s %12s %12s  %s\n", k, "-", a[k], "new (not judged)"; continue }
      if (!(k in a)) { printf "%-28s %12s %12s  %s\n", k, b[k], "-", "gone (not judged)"; continue }
      v = "same"
      if (goal[k] == "info")      v = "info"
      else if (a[k] + 0 == b[k] + 0) v = "same"
      else if ((goal[k] == "min" && a[k] + 0 < b[k] + 0) || (goal[k] == "max" && a[k] + 0 > b[k] + 0)) { v = "better"; better = better (better ? "," : "") k }
      else { v = "WORSE"; worse = worse (worse ? "," : "") k }
      printf "%-28s %12s %12s  %s\n", k, b[k], a[k], v
    }
    print ""
    if (worse != "")       { print "REGRESSION: " worse; exit 1 }
    else if (better != "") { print "IMPROVED: " better; exit 0 }
    else                   { print "NO CHANGE"; exit 0 }
  }
' "$before" "$after"
