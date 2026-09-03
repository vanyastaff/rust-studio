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

# Codex parses this file strictly: one unknown top-level key rejects the WHOLE
# config, so every hook goes silent with a single startup warning. A `_comment`
# key shipped in 0.30.0 and 0.31.0 exactly this way. Only `description` and
# `hooks` are accepted.
bad_keys=$(jq -r 'keys[] | select(. != "description" and . != "hooks")' hooks/codex-hooks.json)
[[ -z $bad_keys ]] ||
  fail "codex-hooks.json has top-level keys Codex rejects (whole file is dropped): $(echo "$bad_keys" | tr '\n' ' ')"

# Codex clamps a SessionEnd hook to 3s whatever the file declares. Declaring more
# is not a bigger budget — it is a script written for time it will never get, and
# the mismatch only surfaces as a startup warning nobody reads.
session_end_timeout=$(jq -r '.hooks.SessionEnd[0].hooks[0].timeout // 0' hooks/codex-hooks.json)
(( session_end_timeout <= 3 )) ||
  fail "codex-hooks.json declares SessionEnd timeout ${session_end_timeout}s; Codex clamps it to 3s"

# Event names Codex recognizes. A typo here is silent too — the hook simply never
# fires. Verified against the Codex binary's hook dispatcher.
codex_events="PreToolUse PostToolUse PermissionRequest PreCompact PostCompact SessionStart SessionEnd SubagentStart SubagentStop Stop UserPromptSubmit Notification"
while IFS= read -r event; do
  [[ " $codex_events " == *" $event "* ]] || fail "codex-hooks.json declares unknown event $event"
done < <(jq -r '.hooks | keys[]' hooks/codex-hooks.json)

# Every hook the Codex file omits should be omitted because it cannot work there,
# not because nobody revisited it. Keep the two files' script sets diffable.
claude_scripts=$(grep -oE '/[a-z-]+\.ts' hooks/claude-hooks.json | sort -u)
codex_scripts=$(grep -oE '/[a-z-]+\.ts' hooks/codex-hooks.json | sort -u)
expected_claude_only=$'/auto-capture.ts\n/model-switch.ts\n/statusline-install.ts\n/subagent-stop.ts'
actual_claude_only=$(comm -23 <(echo "$claude_scripts") <(echo "$codex_scripts"))
[[ $actual_claude_only == "$expected_claude_only" ]] ||
  fail "Claude-only hook set changed — port it to Codex or update the expected list. Got: $(echo "$actual_claude_only" | tr '\n' ' ')"

[[ -x skills/env-setup/scripts/env-setup.sh ]] || fail "env-setup portable script is missing or not executable"
for f in memory-doctor.ts memory-store.ts _lib.ts; do
  [[ -f skills/memory-doctor/scripts/$f ]] || fail "memory-doctor portable bundle is missing $f"
done
grep -q 'bun "scripts/memory-doctor.ts"' skills/memory-doctor/SKILL.md ||
  fail "memory-doctor skill must run its bundled CLI, not a plugin-root path"
! grep -rqE 'OBSIDIAN_VAULT_PATH|vault_path|note_create|search_semantic|obsidian MCP|`obsidian`' \
    skills/*/SKILL.md docs/*.md README.md $(ls hooks/scripts/*.ts | grep -v '\.test\.ts$') ||
  fail "Obsidian-era memory contract remnants: memory is the host's auto-memory store since 0.36.0"

# hooks/hooks.json is auto-discovered by both hosts. Keep the Claude-only lifecycle file
# under an explicit name until every hook is intentionally ported and tested on Codex.
[[ ! -e hooks/hooks.json ]] || fail "hooks/hooks.json would expose Claude-only hooks to Codex"

claude_name=$(jq -r '.name' .claude-plugin/plugin.json)
codex_name=$(jq -r '.name' .codex-plugin/plugin.json)
[[ $claude_name == rust-studio && $codex_name == rust-studio ]] || fail "manifest name mismatch"

claude_version=$(jq -r '.version' .claude-plugin/plugin.json)
codex_version=$(jq -r '.version' .codex-plugin/plugin.json)
[[ $claude_version == "$codex_version" ]] || fail "manifest versions differ"

# The Agent Plugins 1.0 manifest (agent-plugins.org) is what Codex >= 0.147, Cursor, Copilot
# CLI and Kiro load. Its schema is closed: $schema + name are required, the component
# locations are fixed (flat skills/), and it must not drift from the host manifests.
[[ -f plugin.json ]] || fail "missing plugin.json (Agent Plugins 1.0 manifest)"
jq -e '
  ."$schema" == "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json" and
  .name == "rust-studio" and
  (.description | length > 0) and
  (keys - ["$schema","name","version","description","author","homepage","repository","license","keywords","extensions"] | length == 0)
' plugin.json >/dev/null || fail "plugin.json is not a valid Agent Plugins 1.0 manifest (schema, name, or an unknown key)"
[[ $(jq -r '.version' plugin.json) == "$claude_version" ]] || fail "plugin.json version differs from the host manifests"
for skill_dir in skills/*/; do
  [[ -f $skill_dir/SKILL.md ]] || fail "${skill_dir%/} has no SKILL.md — Agent Plugins clients read only immediate children of skills/"
done

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
    add-dep|commit|eval-agents|new-crate|pr|progress-bar|publish|worktree-sweep) expected=1 ;;
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

# Advertised skill counts drift every time a skill lands: the Codex manifest and
# both READMEs claimed 55 at 58 skills. `portable` is the total minus the skills
# whose SKILL.md declares itself Claude-only.
claude_only=$(grep -lF 'Claude Code plugin only' skills/*/SKILL.md | wc -l)
portable=$(( skill_count - claude_only ))
# Each entry is `count<TAB>file<TAB>phrase`, where N stands in for the number.
# Phrases are matched literally, so "58 skills" (total) and "56 skills" (portable)
# stay distinguishable even though both end in the same word.
while IFS=$'\t' read -r want file phrase; do
  [[ -n $want ]] || continue
  literal=${phrase//N/$want}
  if ! grep -qF "$literal" "$file"; then
    # Quote the phrase's literal half before turning N into a number class, so
    # the failure names what IS there instead of an empty string.
    escaped=$(printf '%s' "$phrase" | sed 's/[][\.*^$(){}?+|\\/]/\\&/g')
    found=$(grep -oE "${escaped//N/[0-9]+}" "$file" | sort -u | tr '\n' ' ')
    fail "$file advertises a stale count: expected \"$literal\", found \"${found:-nothing matching}\""
  fi
done <<EOF
$skill_count	.codex-plugin/plugin.json	N focused skills
$skill_count	README.md	**N skills**
$skill_count	../../README.md	skills-N-111111
$skill_count	../../README.md	coding agents: N skills
$skill_count	../../README.md	| N skills |
$portable	../../README.md	The other N skills
$portable	../../README.md	The N host-neutral workflows
$portable	../../INSTALL.md	The N host-neutral workflows
$skill_count	../../INSTALL.md	The N skills are
$skill_count	../../INSTALL.md	gets the N skills
$skill_count	../../install.sh	(N skills, 
$portable	../../install.sh	(N portable skills
$skill_count	plugin.json	coding agents: N skills
$skill_count	docs/usage-guide.md	**Skills** (N)
$skill_count	docs/usage-guide.md	## The skills (N)
EOF

# Codex agents install OUTSIDE the plugin (~/.codex/agents/), so the ${CLAUDE_PLUGIN_ROOT}
# form Claude Code expands has nothing to resolve against there. Generate into a
# throwaway dir and assert nothing unresolved ships: a placeholder in a prompt fails
# silently — the agent treats it as a path, cannot open it, and proceeds regardless.
codex_agent_probe=$(mktemp -d)
node scripts/generate-codex-agents.mjs "$codex_agent_probe" >/dev/null ||
  fail "generate-codex-agents.mjs failed — a malformed brief would vanish from a user's Codex install"
if grep -rlE '\$\{CLAUDE_[A-Z_]*\}' "$codex_agent_probe" >/dev/null 2>&1; then
  fail "generated Codex agents still carry an unresolved \${CLAUDE_…} placeholder"
fi
rm -rf "$codex_agent_probe"

# Catalog drift: a skill that /help and the usage guide never mention is one nobody finds.
# Three skills had gone missing from the guide and one from /help before this gate existed.
for skill_dir in skills/*/; do
  skill=${skill_dir%/}; skill=${skill##*/}
  grep -qF "\`/$skill\`" docs/usage-guide.md || fail "docs/usage-guide.md does not list /$skill"
  grep -qF "\`/$skill\`" skills/help/SKILL.md || fail "skills/help/SKILL.md does not list /$skill"
done

# The README's hook inventory is derived from the hook config, so it cannot drift.
handlers=$(jq '[.hooks[][] | .hooks[]] | length' hooks/claude-hooks.json)
events=$(jq '.hooks | keys | length' hooks/claude-hooks.json)
grep -qF "**$handlers Claude hook handlers across $events events**" README.md ||
  fail "README.md hook inventory is stale: hooks/claude-hooks.json has $handlers handlers across $events events"

# `claude plugin eval` cases: prompt.md with the execution frontmatter and a real prompt,
# at least one grader with a known type, and nothing that assumes this machine — cases
# run in a sandbox cwd, so an absolute path or ~/ silently scores 0.
grader_types="regex tool_order tool_used file_exists llm baseline"
eval_cases=0
for case_dir in evals/*/; do
  [[ -f $case_dir/prompt.md ]] || continue
  eval_cases=$((eval_cases + 1))
  case=${case_dir%/}; case=${case##*/}
  fm=$(awk 'NR==1 && $0!="---" {exit} NR>1 && /^---$/ {exit} NR>1 {print}' "$case_dir/prompt.md")
  for key in max_turns timeout_seconds allowed_tools; do
    grep -qE "^$key:" <<<"$fm" || fail "evals/$case/prompt.md frontmatter lacks $key"
  done
  body=$(awk 'f {print} /^---$/ {n++; if (n==2) f=1}' "$case_dir/prompt.md")
  [[ -n ${body//[[:space:]]/} ]] || fail "evals/$case/prompt.md has no prompt body"
  graders=$(find "$case_dir/graders" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
  (( graders >= 1 )) || fail "evals/$case has no graders"
  for g in "$case_dir"/graders/*.md; do
    t=$(awk -F': *' '/^type:/ { print $2; exit }' "$g")
    [[ " $grader_types " == *" $t "* ]] || fail "$g: grader type '${t:-missing}' is not one of: $grader_types"
  done
  if grep -rnE 'TODO|/home/|~/' "$case_dir" >/dev/null; then
    fail "evals/$case carries a TODO placeholder or a machine-specific path"
  fi
done
(( eval_cases >= 1 )) || fail "no eval cases under evals/"
jq -e '.experimental.evals == "./evals"' .claude-plugin/plugin.json >/dev/null ||
  fail "plugin.json does not declare experimental.evals = ./evals"

node scripts/generate-openai-metadata.mjs --check
./scripts/sync-references.sh --check

echo "distribution valid: $skill_count skills, $description_chars description characters, $eval_cases eval cases, version $codex_version"
