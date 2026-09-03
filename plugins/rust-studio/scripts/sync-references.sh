#!/usr/bin/env bash
# Bundle each skill's referenced docs/rules into skills/<name>/references/.
#
# Agent Skills are self-contained folders: an agent that installs one skill gets only
# that skill's directory. Anything a SKILL.md points at must live inside it. docs/ and
# rules/ stay the single source of truth; this script mirrors what each skill cites.
#
#   ./scripts/sync-references.sh          rebuild every skills/*/references/
#   ./scripts/sync-references.sh --check  fail if any copy is stale (for CI)
#
# A SKILL.md cites a bundled file as `references/<name>.md`. The source is resolved
# from docs/<name>.md or rules/<name>.md. Copies are rewritten so their own
# `${CLAUDE_PLUGIN_ROOT}/{docs,rules}/x.md` links become `references/x.md`, which is how
# the skill's own SKILL.md refers to them — so a link resolves the same from either file.
# Following those links transitively is what pulls in e.g. maintainer-grade-development.md
# for any skill that cites collaboration.md.
set -euo pipefail

cd "$(dirname "$0")/.."
check=0
[[ ${1:-} == --check ]] && check=1

# ponytail: docs/ and rules/ share one flat namespace, so a basename resolves without a
# dir prefix. Bail loudly rather than silently pick one if that ever stops being true.
for f in docs/*.md; do
  [[ -e "rules/$(basename "$f")" ]] && { echo "name collision: $(basename "$f") in docs/ and rules/" >&2; exit 1; }
done

resolve() { # relative name (may contain a subdir, e.g. templates/adr.md) -> source path
  if [[ -f "docs/$1" ]]; then echo "docs/$1"
  elif [[ -f "rules/$1" ]]; then echo "rules/$1"
  else return 1; fi
}

# Every `references/x.md` a file cites, as bare relative names.
cite() { grep -oE 'references/[a-z0-9/-]+\.md' "$1" | sed 's#^references/##' | sort -u || true; }

# Emit the file with its plugin-root links rewritten to skill-relative references/ links.
rewrite() { sed -E 's#\$\{CLAUDE_PLUGIN_ROOT\}/(docs|rules)/#references/#g' "$1"; }

stale=0
for skill in skills/*/; do
  name=${skill%/}; name=${name##*/}
  src=$skill/SKILL.md
  [[ -f $src ]] || continue

  # Transitive closure over `references/<file>.md` citations, starting from SKILL.md.
  declare -A want=()
  queue=$(cite "$src")
  while [[ -n $queue ]]; do
    next=""
    for f in $queue; do
      [[ -n ${want[$f]:-} ]] && continue
      path=$(resolve "$f") || { echo "$src cites references/$f — no docs/$f or rules/$f" >&2; exit 1; }
      want[$f]=$path
      next+=" $(rewrite "$path" | cite /dev/stdin)"
    done
    queue=$next
  done

  dest=$skill/references
  if [[ ${#want[@]} -eq 0 ]]; then
    if [[ -d $dest ]]; then
      (( check )) && { echo "stale: $dest should not exist"; stale=1; } || rm -rf "$dest"
    fi
    unset want; continue
  fi

  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  for f in "${!want[@]}"; do mkdir -p "$tmp/$(dirname "$f")"; rewrite "${want[$f]}" > "$tmp/$f"; done

  if (( check )); then
    if ! diff -qr "$tmp" "$dest" >/dev/null 2>&1; then
      echo "stale: $dest"; diff -qr "$tmp" "$dest" 2>&1 | sed 's/^/  /' || true
      stale=1
    fi
  else
    rm -rf "$dest"; mkdir -p "$dest"; cp -r "$tmp"/. "$dest/"
    echo "$name: ${#want[@]} refs"
  fi
  rm -rf "$tmp"; trap - EXIT
  unset want
done

# Keep deterministic helper code inside the portable skill package. The plugin-level copy is the
# source so existing plugin automation and release paths remain stable.
# <src>:<dest> pairs. memory-doctor's CLI imports memory-store.ts and _lib.ts relatively, so
# all three travel together and the skill stays self-contained.
assets=(
  scripts/env-setup.sh:skills/env-setup/scripts/env-setup.sh
  hooks/scripts/memory-doctor.ts:skills/memory-doctor/scripts/memory-doctor.ts
  hooks/scripts/memory-store.ts:skills/memory-doctor/scripts/memory-store.ts
  hooks/scripts/_lib.ts:skills/memory-doctor/scripts/_lib.ts
)
for pair in "${assets[@]}"; do
  asset_src=${pair%%:*}
  asset_dest=${pair#*:}
  if (( check )); then
    if ! cmp -s "$asset_src" "$asset_dest"; then
      echo "stale: $asset_dest"
      stale=1
    fi
  else
    mkdir -p "$(dirname "$asset_dest")"
    cp "$asset_src" "$asset_dest"
    [[ $asset_dest == *.sh ]] && chmod +x "$asset_dest"
    echo "$(basename "$(dirname "$(dirname "$asset_dest")")"): bundled $(basename "$asset_dest")"
  fi
done

# A skill that names a studio sub-agent must ship the fallback for hosts that have none,
# or it deadlocks on "delegate all writes to rust-builder" where no rust-builder exists.
agent_re="\`($(ls agents/*.md | xargs -n1 basename | sed 's/\.md$//' | paste -sd'|'))\`"
missing=0
for skill in skills/*/; do
  src=$skill/SKILL.md
  [[ -f $src ]] || continue
  grep -qE "$agent_re" "$src" || continue
  grep -q '^> \*\*Plugin-only\.\*\*' "$src" && continue   # plugin install always has the agents
  [[ -f $skill/references/sub-agents.md ]] && continue
  echo "$src names a sub-agent but does not cite references/sub-agents.md"
  missing=1
done
if (( missing )); then
  echo; echo "cite it, directly or via collaboration.md / delegation.md"; exit 1
fi

if (( check )); then
  (( stale )) && { echo; echo "run ./scripts/sync-references.sh"; exit 1; }
  echo "references/ in sync"
fi
