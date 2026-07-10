#!/usr/bin/env bash
# Install Rust Code Studio into every supported agent host found on this machine.
#
#   ./install.sh            detect hosts and install for each
#   ./install.sh --dry-run  print the commands without running them
#
# Claude Code gets the full studio (skills + sub-agents + hooks + status line),
# Codex gets the native plugin (portable skills + install surface), any other
# host gets the portable skills via the skills registry (npx skills add).
# No telemetry, no network calls beyond the hosts' own install commands.
set -euo pipefail

dry=0
[[ ${1:-} == --dry-run ]] && dry=1

# From a clone, install offline from the local path; via curl|bash, from GitHub.
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [[ -f $script_dir/.claude-plugin/marketplace.json ]]; then
  src=$script_dir
else
  src=${RUST_STUDIO_REPO:-vanyastaff/rust-studio}
fi

run() {
  echo "+ $*"
  (( dry )) && return 0
  "$@"
}

found=0

if command -v claude >/dev/null 2>&1; then
  found=1
  echo "Claude Code — full studio (55 skills, 33 sub-agents, hooks, status line)"
  run claude plugin marketplace add "$src"
  run claude plugin install rust-studio@rust-studio
fi

if command -v codex >/dev/null 2>&1; then
  found=1
  echo "Codex — native plugin (55 portable skills + lifecycle hooks)"
  run codex plugin marketplace add "$src"
  run codex plugin add rust-studio@rust-studio
  # Codex plugins can't bundle agent definitions, so generate the 33 studio
  # agents into the personal scope. Needs a clone (script + sources) and node.
  if [[ -d $src/plugins/rust-studio/agents ]] && command -v node >/dev/null 2>&1; then
    run node "$src/plugins/rust-studio/scripts/generate-codex-agents.mjs" "$HOME/.codex/agents"
  else
    echo "  (skipped custom agents: needs a local clone and node)"
  fi
fi

if (( ! found )); then
  if command -v npx >/dev/null 2>&1; then
    echo "No claude/codex CLI found — installing the portable skills via the skills registry"
    run npx skills add "$src"
    found=1
  else
    echo "error: no supported agent host found (claude, codex, or npx)" >&2
    exit 1
  fi
fi

echo
echo "Done. Other hosts (Cursor, OpenCode, Zed, ...): npx skills add $src --agent <name>"
echo "Codex: restart the ChatGPT desktop app; Claude Code: start a new session."
