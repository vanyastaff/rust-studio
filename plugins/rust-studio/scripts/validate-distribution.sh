#!/usr/bin/env bash
# Validate the dual-host distribution without requiring Claude Code or Codex to be installed.
set -euo pipefail

cd "$(dirname "$0")/.."

fail() {
  echo "validation failed: $*" >&2
  exit 1
}

for file in \
  .claude-plugin/plugin.json \
  .codex-plugin/plugin.json \
  ../../.agents/plugins/marketplace.json \
  ../../PRIVACY.md \
  ../../TERMS.md \
  agents/openai.yaml \
  hooks/claude-hooks.json \
  hooks/codex-hooks.json; do
  [[ -f $file ]] || fail "missing $file"
done

# The Codex hook file must stay host-clean: PLUGIN_ROOT only, and every script it
# runs must exist (a typo here fails silently at session start otherwise).
! grep -q 'CLAUDE_' hooks/codex-hooks.json || fail "codex-hooks.json references Claude-only variables"
jq -e '.hooks | type == "object"' hooks/codex-hooks.json >/dev/null || fail "codex-hooks.json is not a hook config"
while IFS= read -r script; do
  [[ -f $script ]] || fail "codex-hooks.json runs missing script $script"
done < <(grep -oE '\$\{PLUGIN_ROOT\}/[a-z/._-]+\.ts' hooks/codex-hooks.json | sed 's#^\${PLUGIN_ROOT}/##')
jq -e '.hooks == "./hooks/codex-hooks.json"' .codex-plugin/plugin.json >/dev/null ||
  fail "Codex manifest does not wire hooks/codex-hooks.json"

[[ -x skills/env-setup/scripts/env-setup.sh ]] || fail "env-setup portable script is missing or not executable"

# hooks/hooks.json is auto-discovered by both hosts. Keep the Claude-only lifecycle file
# under an explicit name until every hook is intentionally ported and tested on Codex.
[[ ! -e hooks/hooks.json ]] || fail "hooks/hooks.json would expose Claude-only hooks to Codex"

claude_name=$(jq -r '.name' .claude-plugin/plugin.json)
codex_name=$(jq -r '.name' .codex-plugin/plugin.json)
[[ $claude_name == rust-studio && $codex_name == rust-studio ]] || fail "manifest name mismatch"

claude_version=$(jq -r '.version' .claude-plugin/plugin.json)
codex_version=$(jq -r '.version' .codex-plugin/plugin.json)
[[ $claude_version == "$codex_version" ]] || fail "manifest versions differ"

jq -e '
  .skills == "./skills/" and
  .interface.displayName == "Rust Code Studio" and
  .interface.category == "Developer Tools" and
  (.interface.defaultPrompt | length > 0) and
  (.homepage | startswith("https://")) and
  (.interface.privacyPolicyURL | startswith("https://")) and
  (.interface.termsOfServiceURL | startswith("https://"))
' .codex-plugin/plugin.json >/dev/null || fail "incomplete Codex manifest"

jq -e '
  .name == "rust-studio" and
  any(.plugins[];
    .name == "rust-studio" and
    .source.source == "local" and
    .source.path == "./plugins/rust-studio" and
    .policy.installation == "AVAILABLE" and
    .policy.authentication == "ON_INSTALL" and
    .category == "Developer Tools")
' ../../.agents/plugins/marketplace.json >/dev/null || fail "invalid Codex marketplace entry"

skill_count=0
description_chars=0
for skill_dir in skills/*/; do
  [[ -f $skill_dir/SKILL.md ]] || continue
  skill=${skill_dir%/}
  skill=${skill##*/}
  skill_count=$((skill_count + 1))

  declared=$(awk -F': ' '/^name:/ { print $2; exit }' "$skill_dir/SKILL.md")
  [[ $declared == "$skill" ]] || fail "$skill: frontmatter name does not match directory"

  description=$(awk '/^description:/ { sub(/^description:[[:space:]]*/, ""); gsub(/^"|"$/, ""); print; exit }' "$skill_dir/SKILL.md")
  [[ -n $description ]] || fail "$skill: missing description"
  description_chars=$((description_chars + ${#description}))

  lines=$(wc -l < "$skill_dir/SKILL.md")
  (( lines < 500 )) || fail "$skill: SKILL.md exceeds 500 lines"
  [[ -f $skill_dir/agents/openai.yaml ]] || fail "$skill: missing agents/openai.yaml"
  grep -Fq "\$$skill" "$skill_dir/agents/openai.yaml" || fail "$skill: default prompt does not mention \$$skill"

  # A side-effecting skill (publishes, commits, scaffolds, rewrites machine config) is
  # user-invoked: only a human starts it. Both harnesses must agree, or the skill fires
  # implicitly on one host and not the other. Claude drops the description from context
  # entirely, so these also cost nothing in the catalog budget there.
  claude_user_invoked=0
  codex_user_invoked=0
  awk '/^---$/ { yaml = !yaml; next } yaml' "$skill_dir/SKILL.md" |
    grep -q '^disable-model-invocation:[[:space:]]*true' && claude_user_invoked=1
  grep -q '^  allow_implicit_invocation:[[:space:]]*false' "$skill_dir/agents/openai.yaml" &&
    codex_user_invoked=1

  case $skill in
    add-dep|commit|eval-agents|new-crate|pr|progress-bar|publish) expected=1 ;;
    *) expected=0 ;;
  esac

  (( claude_user_invoked == expected )) ||
    fail "$skill: Claude invocation axis disagrees with the side-effecting roster (expected disable-model-invocation: $expected)"
  (( codex_user_invoked == expected )) ||
    fail "$skill: Codex invocation axis disagrees with the side-effecting roster (expected allow_implicit_invocation false: $expected)"
done

(( skill_count > 0 )) || fail "no skills found"
openai_metadata_count=$(find skills -path '*/agents/openai.yaml' -type f | wc -l)
(( openai_metadata_count == skill_count )) || fail "OpenAI metadata count does not match skill count"

# Codex budgets the initial skill catalog. Keep descriptions below this repo-level ceiling
# so names and paths still have room inside the current 8,000-character product budget.
(( description_chars <= 6500 )) || fail "skill descriptions use $description_chars characters (limit: 6500)"

unknown_keys=$(awk '
  FNR == 1 { yaml = 0 }
  /^---$/ { yaml = !yaml; next }
  yaml && /^[A-Za-z0-9_-]+:/ {
    key = $1
    sub(/:.*/, "", key)
    if (key !~ /^(name|description|license|compatibility|metadata|allowed-tools|disable-model-invocation)$/) {
      print FILENAME ":" FNR ":" key
    }
  }
' skills/*/SKILL.md)
[[ -z $unknown_keys ]] || fail "unknown skill frontmatter keys:\n$unknown_keys"

# Portable skills must describe host capabilities, not require one vendor's tool names or
# interpolation variables. The two explicitly labeled Claude-only utilities are excluded.
portability_fail=0
for skill in skills/*/SKILL.md; do
  case $skill in
    skills/eval-agents/*|skills/progress-bar/*) continue ;;
  esac
  if grep -nE 'EnterPlanMode|ExitPlanMode|AskUserQuestion|Task(Create|Update|List|Get)|SendMessage|Team(Create|Delete)|CLAUDE_CODE_(EXPERIMENTAL_AGENT_TEAMS|ENABLE_TASKS)|\$\{user_config\.|\$\{CLAUDE_PLUGIN_ROOT\}|\$ARGUMENTS' "$skill"; then
    echo "non-portable host API in $skill" >&2
    portability_fail=1
  fi
done
(( portability_fail == 0 )) || fail "host-specific APIs leaked into portable skills"

if grep -R -n -F '[TODO:' \
  .claude-plugin .codex-plugin agents assets hooks scripts skills \
  --exclude=validate-distribution.sh \
  --exclude-dir=references; then
  fail "scaffold placeholder text remains"
fi

node scripts/generate-openai-metadata.mjs --check
./scripts/sync-references.sh --check

echo "distribution valid: $skill_count skills, $description_chars description characters, version $codex_version"
