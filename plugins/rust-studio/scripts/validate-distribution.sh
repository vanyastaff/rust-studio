#!/usr/bin/env bash
# Validate the dual-host distribution without requiring Claude Code or Codex to be installed.
#
#   ./scripts/validate-distribution.sh          human-readable
#   ./scripts/validate-distribution.sh --json   one JSON object, for CI and for agents
#
# A failure is reported as a STRUCTURED FINDING, not a sentence: a stable code, the exact
# subject it is about, what was measured, and the repair. The reader is usually an agent
# that must fix this without a second round trip, and "validation failed: manifest versions
# differ" tells it neither which manifests nor what to write. Codes are stable across
# releases — cite them in commit messages and issues.
set -euo pipefail

cd "$(dirname "$0")/.."

JSON=0
[[ ${1:-} == --json ]] && JSON=1

# Progress chatter. Silent under --json so stdout stays a single parseable object.
say() { (( JSON )) || echo "$@"; }

_json_escape() { # minimal JSON string escaping for the fields below
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

# Code registry. Numbers are never reused: a code that appears in an old issue must keep
# meaning what it meant. Take the next free number in the area you are adding to.
#
#   RS-DIST-0xx      required files, and this script itself    next: 004
#   RS-CODEX-0xx     Codex hooks and manifest wiring           next: 017
#   RS-HOOK-0xx      hook config shared across hosts           next: 022
#   RS-SCRIPT-0xx    shipped scripts and their contracts       next: 037
#   RS-MEM-0xx       memory-store contract                     next: 041
#   RS-MANIFEST-0xx  plugin manifests and version agreement    next: 059
#   RS-SKILL-0xx     skill structure, frontmatter, metadata    next: 078
#   RS-DATA-0xx      rules/*.json data files                   next: 076
#   RS-AGENT-0xx     agent briefs and their generation         next: 083
#   RS-DOC-0xx       docs and README staying true to the tree  next: 094
#   RS-EVAL-0xx      eval cases                                next: 106
#   RS-REF-1xx       bundled skill references                  next: 111
#
# fail <code> <subject> <problem> [fix]
#   code     stable RS-<AREA>-<NNN> identifier
#   subject  the exact thing at fault — a path, ideally with the key inside it
#   problem  what was measured, not a category
#   fix      the repair, when there is one specific enough to name
fail() {
  local code=$1 subject=$2 problem=$3 fix=${4:-}
  if (( JSON )); then
    printf '{"ok":false,"finding":{"code":"%s","subject":"%s","problem":"%s","fix":"%s"}}\n' \
      "$(_json_escape "$code")" "$(_json_escape "$subject")" \
      "$(_json_escape "$problem")" "$(_json_escape "$fix")"
  else
    {
      echo "validation failed"
      echo
      printf '  %-14s %s\n' "$code" "$subject"
      printf '  %-14s %s\n' "problem" "$problem"
      [[ -n $fix ]] && printf '  %-14s %s\n' "fix" "$fix"
    } >&2
  fi
  exit 1
}

# --json promises ONE parseable object on stdout. A diagnostic block that prints its
# offenders to stdout breaks that promise silently — the caller gets a JSON parse error
# instead of the finding, which is worse than the finding.
stdout_blocks=$(grep -cE "^python3 - <<'" scripts/validate-distribution.sh || true)
(( stdout_blocks == 0 )) || fail RS-DIST-003 "scripts/validate-distribution.sh" \
  "$stdout_blocks diagnostic block(s) write to stdout, which corrupts --json output" \
  "invoke them as \`python3 - >&2 <<'TAG'\` so offender lines go to stderr"

# This script's own promise first: a finding code is a stable identifier, so two checks
# must never share one. A copy-pasted code is the easy way to break that silently.
dup_codes=$(grep -oE 'fail RS-[A-Z]+-[0-9]+' scripts/validate-distribution.sh | awk '{print $2}' | sort | uniq -d)
[[ -z $dup_codes ]] || fail RS-DIST-002 "scripts/validate-distribution.sh" \
  "duplicate finding code(s): $(echo "$dup_codes" | tr '\n' ' ')" \
  "codes are never reused — take the next free number from the registry at the top of this file"

for file in \
  .claude-plugin/plugin.json \
  .codex-plugin/plugin.json \
  ../../.agents/plugins/marketplace.json \
  ../../PRIVACY.md \
  ../../TERMS.md \
  agents/openai.yaml \
  hooks/claude-hooks.json \
  hooks/codex-hooks.json; do
  [[ -f $file ]] || fail RS-DIST-001 "$file" "required distribution file is missing" "restore the file, or drop it from the required list in this script"
done

# The Codex hook file must stay host-clean: PLUGIN_ROOT only, and every script it
# runs must exist (a typo here fails silently at session start otherwise).
! grep -q 'CLAUDE_' hooks/codex-hooks.json || fail RS-CODEX-010 "hooks/codex-hooks.json" "references a CLAUDE_ variable, which Codex never sets" "use \${PLUGIN_ROOT} instead"
jq -e '.hooks | type == "object"' hooks/codex-hooks.json >/dev/null || fail RS-CODEX-011 "hooks/codex-hooks.json#hooks" "not an object, so Codex does not read it as a hook config" "make .hooks an object keyed by event name"
while IFS= read -r script; do
  [[ -f $script ]] || fail RS-CODEX-012 "hooks/codex-hooks.json -> $script" "the script it runs does not exist; the hook fails silently at session start" "add the script, or correct the path in the hook config"
done < <(grep -oE '\$\{PLUGIN_ROOT\}/[a-z/._-]+\.ts' hooks/codex-hooks.json | sed 's#^\${PLUGIN_ROOT}/##')
jq -e '.hooks == "./hooks/codex-hooks.json"' .codex-plugin/plugin.json >/dev/null ||
  fail RS-CODEX-013 ".codex-plugin/plugin.json#hooks" "does not point at ./hooks/codex-hooks.json, so no Codex hook runs at all" "set \"hooks\": \"./hooks/codex-hooks.json\""

# Codex parses this file strictly: one unknown top-level key rejects the WHOLE
# config, so every hook goes silent with a single startup warning. A `_comment`
# key shipped in 0.30.0 and 0.31.0 exactly this way. Only `description` and
# `hooks` are accepted.
bad_keys=$(jq -r 'keys[] | select(. != "description" and . != "hooks")' hooks/codex-hooks.json)
[[ -z $bad_keys ]] ||
  fail RS-CODEX-014 "hooks/codex-hooks.json (top level)" "unknown key(s): $(echo "$bad_keys" | tr '\n' ' ') — Codex rejects the WHOLE file, silencing every hook with one startup warning" "keep only description and hooks"

# Codex clamps a SessionEnd hook to 3s whatever the file declares. Declaring more
# is not a bigger budget — it is a script written for time it will never get, and
# the mismatch only surfaces as a startup warning nobody reads.
session_end_timeout=$(jq -r '.hooks.SessionEnd[0].hooks[0].timeout // 0' hooks/codex-hooks.json)
(( session_end_timeout <= 3 )) ||
  fail RS-CODEX-015 "hooks/codex-hooks.json#SessionEnd.timeout" "declares ${session_end_timeout}s; Codex clamps SessionEnd to 3s" "set the timeout to 3 or less, and write the script for 3s"

# Event names Codex recognizes. A typo here is silent too — the hook simply never
# fires. Verified against the Codex binary's hook dispatcher.
codex_events="PreToolUse PostToolUse PermissionRequest PreCompact PostCompact SessionStart SessionEnd SubagentStart SubagentStop Stop UserPromptSubmit Notification"
while IFS= read -r event; do
  [[ " $codex_events " == *" $event "* ]] || fail RS-CODEX-016 "hooks/codex-hooks.json#$event" "not an event Codex dispatches, so the hook never fires" "use one of: $codex_events"
done < <(jq -r '.hooks | keys[]' hooks/codex-hooks.json)

# Every hook the Codex file omits should be omitted because it cannot work there,
# not because nobody revisited it. Keep the two files' script sets diffable.
claude_scripts=$(grep -oE '/[a-z-]+\.ts' hooks/claude-hooks.json | sort -u)
codex_scripts=$(grep -oE '/[a-z-]+\.ts' hooks/codex-hooks.json | sort -u)
# subagent-stop stays Claude-only on purpose. Codex fires the SubagentStop event, but the
# hook needs the sub-agent's FINAL MESSAGE, which it gets from Claude-specific payload
# fields or by resolving `<session_dir>/subagents/<agent-id>.jsonl`. Codex stores
# transcripts as sessions/YYYY/MM/DD/rollout-*.jsonl with no subagents/ directory, so the
# hook would run, find nothing, and enforce nothing — coverage that looks real and is not.
expected_claude_only=$'/auto-capture.ts\n/model-switch.ts\n/statusline-install.ts\n/subagent-stop.ts'
actual_claude_only=$(comm -23 <(echo "$claude_scripts") <(echo "$codex_scripts"))
[[ $actual_claude_only == "$expected_claude_only" ]] ||
  fail RS-HOOK-020 "hooks/claude-hooks.json vs hooks/codex-hooks.json" "the Claude-only hook set is now: $(echo "$actual_claude_only" | tr '\n' ' ')" "port the new hook to Codex, or add it to expected_claude_only in this script once that is a deliberate gap"

[[ -x skills/env-setup/scripts/env-setup.sh ]] || fail RS-SCRIPT-030 "skills/env-setup/scripts/env-setup.sh" "missing, or present without the executable bit" "run ./scripts/sync-references.sh, then chmod +x the bundled copy"
for f in memory-doctor.ts memory-store.ts _lib.ts; do
  [[ -f skills/memory-doctor/scripts/$f ]] || fail RS-SCRIPT-031 "skills/memory-doctor/scripts/$f" "the skill ships a CLI whose bundle is incomplete, so it breaks once installed standalone" "run ./scripts/sync-references.sh to rebuild the bundle"
done
grep -q 'bun "scripts/memory-doctor.ts"' skills/memory-doctor/SKILL.md ||
  fail RS-SCRIPT-032 "skills/memory-doctor/SKILL.md" "does not invoke bun \"scripts/memory-doctor.ts\"; a plugin-root path does not resolve for a standalone install" "cite the bundled path, not a host-specific plugin root"
! grep -rqE 'OBSIDIAN_VAULT_PATH|vault_path|note_create|search_semantic|obsidian MCP|`obsidian`' \
    skills/*/SKILL.md docs/*.md README.md $(ls hooks/scripts/*.ts | grep -v '\.test\.ts$') ||
  fail RS-MEM-040 "skills/*/SKILL.md, docs/*.md, README.md, hooks/scripts/*.ts" "Obsidian-era memory contract remnants (vault path / MCP note tools) survive" "memory has been the host auto-memory store since 0.36.0 — remove the reference or rewrite it against docs/memory-protocol.md"

# --- shipped-script contract ------------------------------------------------------
# A skill that ships scripts/ ships a CLI, and it is run by two callers with different
# needs: an agent following SKILL.md, and a person deciding whether to let the agent run
# it at all. The second one has no way in except `--help`, so a shipped entry point that
# cannot introduce itself is not finished. And a bundled script with no test is code that
# reaches a user machine having never been executed by CI — env-setup.sh, which provisions
# the machine, was in exactly that state.
#
# An entry point is an executable .sh or a .ts with `import.meta.main`; the library modules
# bundled next to one (_lib.ts, memory-store.ts) are exempt from both rules.
entry_points=()
for scripts_dir in skills/*/scripts; do
  [[ -d $scripts_dir ]] || continue
  skill=${scripts_dir%/scripts}; skill=${skill##*/}
  found=0
  for f in "$scripts_dir"/*; do
    [[ -f $f ]] || continue
    case $f in
      *.sh) [[ -x $f ]] || continue ;;
      *.ts) grep -q 'import\.meta\.main' "$f" || continue ;;
      *) continue ;;
    esac
    found=1
    entry_points+=("$f")
  done
  (( found )) || fail RS-SCRIPT-036 "$scripts_dir" \
    "ships a scripts/ directory with no runnable entry point (no executable .sh, no .ts with import.meta.main)" \
    "make the CLI executable, or drop the directory — a bundle nothing can run is dead weight in every install of /$skill"
done

for f in "${entry_points[@]}"; do
  base=${f##*/}; stem=${base%.*}

  # --help. Skipped for a .ts entry point when bun is absent (a bare image can still run the
  # rest of this validator) — but only this check, never the test-coverage one below.
  help_rc=0; help_out=""; checked_help=1
  case $f in
    *.sh) help_out=$(bash "$f" --help </dev/null 2>/dev/null) || help_rc=$? ;;
    *.ts)
      if command -v bun >/dev/null 2>&1; then
        help_out=$(bun "$f" --help </dev/null 2>/dev/null) || help_rc=$?
      else
        checked_help=0
      fi ;;
  esac
  if (( checked_help )); then
    (( help_rc == 0 )) && [[ -n ${help_out//[[:space:]]/} ]] || fail RS-SCRIPT-034 "$f --help" \
      "exits $help_rc, and prints $( [[ -n ${help_out//[[:space:]]/} ]] && echo "output" || echo "nothing" )" \
      "make --help print usage and exit 0 — it is the only way a person can review what an agent is about to run"
  fi

  # The bundled copy is generated; the test covers the source it is generated from, so the
  # test is looked up by basename anywhere in the tree rather than beside the bundle.
  [[ -n $(find . -name "$stem.test.ts" -not -path './skills/*' -print -quit) ]] || fail RS-SCRIPT-035 "$f" \
    "a shipped CLI with no $stem.test.ts anywhere outside skills/" \
    "add tests for the source this bundle is generated from — it reaches user machines otherwise untested"
done

# hooks/hooks.json is auto-discovered by both hosts. Keep the Claude-only lifecycle file
# under an explicit name until every hook is intentionally ported and tested on Codex.
[[ ! -e hooks/hooks.json ]] || fail RS-HOOK-021 "hooks/hooks.json" "both hosts auto-discover this filename, so Claude-only hooks would run on Codex untested" "keep the Claude set in hooks/claude-hooks.json until each hook is ported and tested"

claude_name=$(jq -r '.name' .claude-plugin/plugin.json)
codex_name=$(jq -r '.name' .codex-plugin/plugin.json)
[[ $claude_name == rust-studio && $codex_name == rust-studio ]] || fail RS-MANIFEST-050 ".claude-plugin/plugin.json#name, .codex-plugin/plugin.json#name" "names are '$claude_name' and '$codex_name'; both must be rust-studio" "set both to rust-studio"

claude_version=$(jq -r '.version' .claude-plugin/plugin.json)
codex_version=$(jq -r '.version' .codex-plugin/plugin.json)
[[ $claude_version == "$codex_version" ]] || fail RS-MANIFEST-051 ".claude-plugin/plugin.json#version vs .codex-plugin/plugin.json#version" "versions are $claude_version and $codex_version" "bump both manifests and plugin.json together"

# The Agent Plugins 1.0 manifest (agent-plugins.org) is what Codex >= 0.147, Cursor, Copilot
# CLI and Kiro load. Its schema is closed: $schema + name are required, the component
# locations are fixed (flat skills/), and it must not drift from the host manifests.
# The root Agent Plugins 1.0 manifest is deliberately ABSENT, and this guard is why.
# Measured on Codex CLI 0.153.4: when a root plugin.json carrying
# `$schema: agent-plugins.org/.../plugin.schema.json` is present, Codex loads the plugin
# through its Agent Plugins path — which parses skills, MCP servers and apps but NOT hooks
# (openai/codex#16430) — and reports "No plugin hooks" in its own plugin panel with no
# warning. Every studio hook goes silent: no briefing, no path-scoped standards, no
# sub-agent brief. Removing the file restores all seven Codex hooks; so does removing just
# the `$schema` key, but that key is REQUIRED by the standard (`required: ["$schema","name"]`)
# and `additionalProperties: false` forbids declaring `hooks` there, so there is no compliant
# way to have both. The `extensions` escape hatch was tried under `com.openai` and
# `com.openai.codex`; Codex does not read hooks from it.
#
# Restore this manifest only together with evidence that Codex executes plugin hooks while it
# is present — the marker-file probe in docs/adr/0002 answers that in one run.
[[ ! -f plugin.json ]] || fail RS-MANIFEST-058 "plugin.json" \
  "the root Agent Plugins 1.0 manifest is back; on Codex its \$schema switches loading to a path that silently drops every plugin hook" \
  "delete it, or prove with the marker probe that Codex now runs plugin hooks alongside it (openai/codex#16430)"
for skill_dir in skills/*/; do
  [[ -f $skill_dir/SKILL.md ]] || fail RS-SKILL-060 "${skill_dir%/}" "no SKILL.md; Agent Plugins clients read only immediate children of skills/, so this directory is invisible" "add SKILL.md, or move the directory out of skills/"
done

jq -e '
  .skills == "./skills/" and
  .interface.displayName == "Rust Code Studio" and
  .interface.category == "Developer Tools" and
  (.interface.defaultPrompt | length > 0) and
  (.homepage | startswith("https://")) and
  (.interface.privacyPolicyURL | startswith("https://")) and
  (.interface.termsOfServiceURL | startswith("https://"))
' .codex-plugin/plugin.json >/dev/null || fail RS-MANIFEST-055 ".codex-plugin/plugin.json#interface" "incomplete: needs skills=./skills/, displayName \"Rust Code Studio\", category \"Developer Tools\", a non-empty defaultPrompt, and https homepage / privacyPolicyURL / termsOfServiceURL" "fill the missing field(s); the Codex store rejects the plugin without them"

# --- rules/stdlib-timeline.json: the MSRV-gated idiom set -------------------------
# Version-keyed stabilizations live here as data so `inject-rules.ts` can filter them to
# the crate's `rust-version` before an agent sees them. A malformed entry is worse than a
# missing one: the loader drops it silently, and the crate quietly stops being told about
# an idiom nobody notices is gone.
timeline=rules/stdlib-timeline.json
[[ -f $timeline ]] || fail RS-DATA-070 "$timeline" "missing; the MSRV-gated idiom set has no data and inject-rules.ts falls silent" "restore the file (see hooks/scripts/stdlib-timeline.ts for the shape)"
jq -e '.entries | type == "array" and length > 0' "$timeline" >/dev/null \
  || fail RS-DATA-071 "$timeline#entries" "not a non-empty array" "add at least one stabilization entry"
bad=$(jq -r '
  .entries
  | to_entries[]
  | select(
      (.value.version | type != "string" or test("^[0-9]+\\.[0-9]+") | not)
      or (.value.kind | IN("idiom", "breakage") | not)
      or (.value.item | type != "string" or length == 0)
      or (.value.instead | type != "string" or length == 0)
      or (.value.clippy != null and (.value.clippy | type != "string" or test("clippy::|^$")))
    )
  | "entry \(.key) (\(.value.item // "no item"))"
' "$timeline")
[[ -z $bad ]] || fail RS-DATA-072 "$timeline" "entries the loader would silently drop: $bad" "each entry needs version (N.N), kind (idiom|breakage), non-empty item and instead; clippy must be a bare lint name without the clippy:: prefix"
sorted=$(jq -r '[.entries[].version] | map(split(".") | map(tonumber))' "$timeline")
[[ $sorted == "$(jq -r '[.entries[].version] | map(split(".") | map(tonumber)) | sort' "$timeline")" ]] \
  || fail RS-DATA-073 "$timeline#entries" "not in ascending version order" "sort entries chronologically so a new release appends to the end"
# Every lint named must exist, or the suggested `cargo clippy -W ...` command errors out.
# Only checkable where clippy is installed; skipped rather than assumed in a bare CI image.
if command -v clippy-driver >/dev/null 2>&1; then
  probe=$(mktemp -d)/probe.rs
  echo 'fn main(){}' > "$probe"
  known=$(clippy-driver -Whelp "$probe" 2>/dev/null | sed 's/^ *//' | awk '{print $1}' \
    | grep '^clippy::' | sed 's/^clippy:://' | tr '-' '_' | sort -u)
  for lint in $(jq -r '.entries[].clippy // empty' "$timeline" | sort -u); do
    grep -qx "$lint" <<<"$known" || fail RS-DATA-074 "$timeline -> clippy::$lint" "this toolchain ($(rustc --version 2>/dev/null | cut -d\" \" -f2)) does not define that lint, so the suggested cargo clippy command would error out" "check the name with clippy-driver -Whelp (it prints hyphenated names), or drop the clippy field"
  done
fi
# Regression guard: the version-keyed list moved OUT of core.md. Prose cannot be gated on a
# crate's MSRV, which is how a 1.70 crate ended up being told to use a 1.98 API.
! grep -qE '\*\*1\.[0-9]+\*\*' rules/core.md \
  || fail RS-DATA-075 "rules/core.md" "enumerates Rust versions in prose again" "prose cannot be gated on a crate MSRV, which is how a 1.70 crate got told to use a 1.98 API — move the entry into $timeline"

jq -e '
  .name == "rust-studio" and
  any(.plugins[];
    .name == "rust-studio" and
    .source.source == "local" and
    .source.path == "./plugins/rust-studio" and
    .policy.installation == "AVAILABLE" and
    .policy.authentication == "ON_INSTALL" and
    .category == "Developer Tools")
' ../../.agents/plugins/marketplace.json >/dev/null || fail RS-MANIFEST-056 "../../.agents/plugins/marketplace.json" "the rust-studio entry is missing or malformed: needs source local at ./plugins/rust-studio, installation AVAILABLE, authentication ON_INSTALL, category \"Developer Tools\"" "fix the entry; Codex cannot install the plugin without it"

skill_count=0
description_chars=0
for skill_dir in skills/*/; do
  [[ -f $skill_dir/SKILL.md ]] || continue
  skill=${skill_dir%/}
  skill=${skill##*/}
  skill_count=$((skill_count + 1))

  declared=$(awk -F': ' '/^name:/ { print $2; exit }' "$skill_dir/SKILL.md")
  [[ $declared == "$skill" ]] || fail RS-SKILL-061 "skills/$skill/SKILL.md#name" "declares '$declared'; the directory is '$skill'" "make the frontmatter name equal the directory name — hosts address the skill by directory"

  description=$(awk '/^description:/ { sub(/^description:[[:space:]]*/, ""); gsub(/^"|"$/, ""); print; exit }' "$skill_dir/SKILL.md")
  [[ -n $description ]] || fail RS-SKILL-062 "skills/$skill/SKILL.md#description" "empty or absent" "add a one-line description starting with \"Use when …\" — it is the only text the router sees"
  description_chars=$((description_chars + ${#description}))

  lines=$(wc -l < "$skill_dir/SKILL.md")
  (( lines < 500 )) || fail RS-SKILL-063 "skills/$skill/SKILL.md" "$lines lines, over the 500-line ceiling" "move detail into references/ and cite it; the body is loaded in full every invocation"
  [[ -f $skill_dir/agents/openai.yaml ]] || fail RS-SKILL-064 "skills/$skill/agents/openai.yaml" "missing, so the skill has no OpenAI-host metadata" "run node scripts/generate-openai-metadata.mjs"
  grep -Fq "\$$skill" "$skill_dir/agents/openai.yaml" || fail RS-SKILL-065 "skills/$skill/agents/openai.yaml" "its default prompt does not mention \$$skill" "regenerate with node scripts/generate-openai-metadata.mjs"

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
    add-dep|commit|eval-agents|migrate|new-crate|pr|progress-bar|publish|worktree-sweep) expected=1 ;;
    *) expected=0 ;;
  esac

  (( claude_user_invoked == expected )) ||
    fail RS-SKILL-066 "skills/$skill/SKILL.md#disable-model-invocation" "expected $expected for this skill's side-effecting classification" "set the key to $expected, or move the skill on the side-effecting roster in this script"
  (( codex_user_invoked == expected )) ||
    fail RS-SKILL-067 "skills/$skill/agents/openai.yaml#allow_implicit_invocation" "expected allow_implicit_invocation false to be $expected for this skill's side-effecting classification" "regenerate the metadata, or move the skill on the side-effecting roster in this script"
done

(( skill_count > 0 )) || fail RS-SKILL-068 "skills/" "no skill directory contains a SKILL.md" "the distribution ships no skills at all — check that you are running from the plugin root"
openai_metadata_count=$(find skills -path '*/agents/openai.yaml' -type f | wc -l)
(( openai_metadata_count == skill_count )) || fail RS-SKILL-069 "skills/*/agents/openai.yaml" "$openai_metadata_count metadata files for $skill_count skills" "run node scripts/generate-openai-metadata.mjs"

# Codex budgets the initial skill catalog. Keep descriptions below this repo-level ceiling
# so names and paths still have room inside the current 8,000-character product budget.
(( description_chars <= 6500 )) || fail RS-SKILL-070 "skills/*/SKILL.md#description (total)" "$description_chars characters against a 6500 budget" "shorten the longest descriptions; every one is loaded into the router context on every session"

unknown_keys=$(awk '
  FNR == 1 { yaml = 0 }
  /^---$/ { yaml = !yaml; next }
  yaml && /^[A-Za-z0-9_-]+:/ {
    key = $1
    sub(/:.*/, "", key)
    if (key !~ /^(name|description|license|compatibility|metadata|allowed-tools|disable-model-invocation|argument-hint)$/) {
      print FILENAME ":" FNR ":" key
    }
  }
' skills/*/SKILL.md)
[[ -z $unknown_keys ]] || fail RS-SKILL-071 "skills/*/SKILL.md frontmatter" "unknown key(s): $(echo "$unknown_keys" | tr '\n' ' ')" "hosts ignore unknown keys silently — remove them, or add the key to the allowed set in this script once a host documents it"

# `claude plugin validate --strict` does not inspect agent frontmatter at all. Confirmed by
# planting `totallyMadeUpKey: banana`, `permissionMode: not_a_real_mode`, and
# `isolation: teleport` into agents/rust-scout.md and re-running the validator: all three
# passed (re-confirmed against Claude Code 2.1.260). Skills get the check above (`unknown
# skill frontmatter keys`); agents did not, so a typo in `disallowedTools`, a bad `model:`
# value, or an invented key in any of the 33 agent briefs would ship silently.
#
# What the plugin *validator* misses, the Claude Code *binary* does not: it ships the real Zod
# schema that gates agent frontmatter (`WVr` in the 2.1.260 bundle, wired as
# `agent: m(()=>WVr().strict())` with a `.safeParse()` that flags `unrecognized_keys`). That
# schema — not what today's 33 briefs happen to use, and not a list this repo cannot verify the
# host honours — is ALLOWED_KEYS's source of truth. Re-derive it after a Claude Code update:
#
#   BIN=$(readlink -f "$(command -v claude)")   # resolves the launcher symlink to the real binary
#   grep -aoP '(?<=describe\("Agent identifier)[\s\S]*?(?=\.describe\("Experimental per-agent options)' "$BIN" \
#     | grep -oP '(?:^|[,(])\K[A-Za-z][A-Za-z0-9_-]*(?=:[a-zA-Z_]+[(\[{])' \
#     | sort -u
#   # then add "name" and "experimental" by hand: "name" sits inside the describe() text used
#   # as the start anchor, so the regex can't see its own key; "experimental" is excluded by
#   # the end anchor it's paired with (its own describe() is the boundary).
#
# Extracted 2026-09-04 from Claude Code 2.1.260 (binary at
# ~/.local/share/claude/versions/2.1.260): 20 keys, matched below. `agents/openai.yaml` is
# Codex metadata, not an agent brief, and is skipped by the `*.md` glob below.
python3 - >&2 <<'AGENTFRONTMATTER' || fail RS-AGENT-080 "agents/*.md frontmatter" "an agent brief violates the frontmatter gate — the failing class is printed above" "fix the brief named above; the gate detail is in the python block in this script"
import re, pathlib, sys

# Every key Claude Code 2.1.260's own agent-frontmatter schema recognizes (see the extraction
# command above this heredoc) — not what the 33 briefs happen to use today. A key the briefs
# don't use yet still passes: adopting it is a later product decision, not a build failure now.
# Only a key in neither this set nor current brief usage is an error.
ALLOWED_KEYS = {
    "name", "description", "model", "tools", "disallowedTools", "color", "effort",
    "permissionMode", "mcpServers", "hooks", "maxTurns", "skills", "initialPrompt",
    "memory", "background", "isolation", "observer", "observerMessage",
    "observeSubagents", "experimental",
}
# `permissionMode`, `hooks`, and `mcpServers` are real, host-recognized keys, but for a
# *plugin*-loaded agent specifically — which is what every agents/*.md here is once this repo
# ships — the plugin agent loader reads and then explicitly ignores all three with a runtime
# warning ("...is ignored for plugin agents. Use .claude/agents/ for this level of control.",
# found in the same 2.1.260 bundle's plugin-agent-frontmatter parser). They still belong in
# ALLOWED_KEYS: this gate's job is "is this key real", not "does it do anything in every
# install context" — but adopting one here is a no-op until installed as a personal agent.
#
# `isolation` is deliberately NOT enum-checked against "none"/"worktree" even though that exact
# two-value enum exists in the 2.1.260 binary: it belongs to an unrelated session-dispatch
# schema (terminal respawn/worktree launch), not to `WVr`. In the schema that actually gates
# this file, `isolation` is an unconstrained optional string, same shape as `color`/`effort`/
# `permissionMode`. Enforcing that enum here would repeat the exact mistake this gate is being
# corrected for: a constraint the host doesn't actually apply at this layer, hand-written
# because it "sounds right" rather than sourced from the schema that governs this file.
#
# The four model values below remain a repo policy, not a host constraint: `WVr`'s `model`
# field is also an unconstrained optional string — the host defers model-name validation to
# wherever the value is resolved, not to frontmatter parsing. Keep this list in sync with what
# the plugin actually ships (grep-verified across every brief).
ALLOWED_MODELS = {"inherit", "sonnet", "opus", "haiku"}

bad = 0
def violate(msg):
    global bad
    print(msg)
    bad += 1

for f in sorted(pathlib.Path("agents").glob("*.md")):
    text = f.read_text(encoding="utf-8")
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m:
        violate(f"{f}: no frontmatter block")
        continue
    name_value = None
    for i, line in enumerate(m.group(1).splitlines(), 1):
        if not re.match(r'^[A-Za-z0-9_-]+:', line):
            continue
        key, _, value = line.partition(':')
        value = value.strip()
        if key not in ALLOWED_KEYS:
            violate(f"{f}:{i}: unknown agent frontmatter key {key!r}")
            continue
        if key == "name":
            name_value = value
        elif key == "model" and value not in ALLOWED_MODELS:
            violate(f"{f}:{i}: model {value!r} is not one of {sorted(ALLOWED_MODELS)}")
    if name_value != f.stem:
        violate(f"{f}: frontmatter name {name_value!r} does not match filename {f.stem!r}")

sys.exit(1 if bad else 0)
AGENTFRONTMATTER

# Portable skills must describe host capabilities, not require one vendor's tool names or
# interpolation variables. The two explicitly labeled Claude-only utilities are excluded.
portability_fail=0
for skill in skills/*/SKILL.md; do
  case $skill in
    skills/eval-agents/*|skills/progress-bar/*) continue ;;
  esac
  # Tool NAMES, not capabilities. `Task(Create|…)` alone let `TaskStop` and `Monitor` through
  # into /resolve-pr, whose Mode B then told a Codex or standalone install to "arm a `Monitor`"
  # — a tool that does not exist there. Match the backticked token so prose using the word
  # ("while the monitor runs") still passes.
  if grep -nE 'EnterPlanMode|ExitPlanMode|AskUserQuestion|Task(Create|Update|List|Get|Stop|Output)|SendMessage|Team(Create|Delete)|`(Monitor|BashOutput|KillShell|SlashCommand|TodoWrite|ScheduleWakeup|SendUserFile|CronCreate|CronList|CronDelete|EnterWorktree|ExitWorktree|PushNotification|RemoteTrigger)`|`/(loop|schedule|code-review|simplify|init|run|design|dataviz)`|CLAUDE_CODE_(EXPERIMENTAL_AGENT_TEAMS|ENABLE_TASKS)|\$\{user_config\.|\$\{CLAUDE_PLUGIN_ROOT\}|\$ARGUMENTS' "$skill"; then
    echo "non-portable host API in $skill" >&2
    portability_fail=1
  fi
done
(( portability_fail == 0 )) || fail RS-SKILL-072 "skills/*/SKILL.md" "$portability_fail host-specific API reference(s), listed above" "cite references/<name>.md instead of a host plugin-root variable — a bundled skill must resolve on any host"

if grep -R -n -F '[TODO:' \
  .claude-plugin .codex-plugin agents assets hooks scripts skills \
  --exclude=validate-distribution.sh \
  --exclude-dir=references; then
  fail RS-SKILL-073 "skills/*/SKILL.md" "scaffold placeholder text survives, listed above" "replace the placeholder with real content before shipping"
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
    fail RS-DOC-090 "$file" "advertises \"${found:-nothing matching}\" where the tree measures \"$literal\"" "update the sentence to \"$literal\""
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
$skill_count	docs/usage-guide.md	**Skills** (N)
$skill_count	docs/usage-guide.md	## The skills (N)
EOF

# Codex agents install OUTSIDE the plugin (~/.codex/agents/), so the ${CLAUDE_PLUGIN_ROOT}
# form Claude Code expands has nothing to resolve against there. Generate into a
# throwaway dir and assert nothing unresolved ships: a placeholder in a prompt fails
# silently — the agent treats it as a path, cannot open it, and proceeds regardless.
codex_agent_probe=$(mktemp -d)
node scripts/generate-codex-agents.mjs "$codex_agent_probe" >/dev/null ||
  fail RS-AGENT-081 "scripts/generate-codex-agents.mjs" "exited non-zero, so a malformed brief would vanish from a user Codex install rather than fail loudly" "run the script directly to see which brief it choked on"
if grep -rlE '\$\{CLAUDE_[A-Z_]*\}' "$codex_agent_probe" >/dev/null 2>&1; then
  fail RS-AGENT-082 "generated Codex agents" "an unresolved \${CLAUDE_…} placeholder survives generation, so the path is dead on Codex" "resolve the variable in the source brief under agents/"
fi
rm -rf "$codex_agent_probe"

# Catalog drift: a skill that /help and the usage guide never mention is one nobody finds.
# Three skills had gone missing from the guide and one from /help before this gate existed.
for skill_dir in skills/*/; do
  skill=${skill_dir%/}; skill=${skill##*/}
  grep -qF "\`/$skill\`" docs/usage-guide.md || fail RS-DOC-091 "docs/usage-guide.md" "does not list /$skill" "add a \`/$skill\` entry — an unlisted skill is one a user never finds"
  grep -qF "\`/$skill\`" skills/help/SKILL.md || fail RS-DOC-092 "skills/help/SKILL.md" "does not list /$skill" "add a \`/$skill\` entry to the catalog"
done

# The README's hook inventory is derived from the hook config, so it cannot drift.
handlers=$(jq '[.hooks[][] | .hooks[]] | length' hooks/claude-hooks.json)
events=$(jq '.hooks | keys | length' hooks/claude-hooks.json)
grep -qF "**$handlers Claude hook handlers across $events events**" README.md ||
  fail RS-DOC-093 "README.md (hook inventory)" "hooks/claude-hooks.json measures $handlers handlers across $events events" "update the README sentence to those two numbers"

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
    grep -qE "^$key:" <<<"$fm" || fail RS-EVAL-100 "evals/$case/prompt.md frontmatter" "lacks the required key $key" "add $key to the frontmatter"
  done
  body=$(awk 'f {print} /^---$/ {n++; if (n==2) f=1}' "$case_dir/prompt.md")
  [[ -n ${body//[[:space:]]/} ]] || fail RS-EVAL-101 "evals/$case/prompt.md" "frontmatter only, no prompt body" "write the prompt the case actually sends"
  graders=$(find "$case_dir/graders" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
  (( graders >= 1 )) || fail RS-EVAL-102 "evals/$case" "no graders, so the case can never fail" "add at least one grader of type: $grader_types"
  for g in "$case_dir"/graders/*.md; do
    t=$(awk -F': *' '/^type:/ { print $2; exit }' "$g")
    [[ " $grader_types " == *" $t "* ]] || fail RS-EVAL-103 "$g" "grader type '${t:-missing}' is not recognized" "use one of: $grader_types"
  done
  if grep -rnE 'TODO|/home/|~/' "$case_dir" >/dev/null; then
    fail RS-EVAL-104 "evals/$case" "carries a TODO placeholder or a machine-specific path, which passes here and fails on every other machine" "replace it with a repo-relative path or real content"
  fi
done
(( eval_cases >= 1 )) || fail RS-EVAL-105 "evals/" "no eval cases found" "the suite the manifest advertises does not exist — add a case or drop experimental.evals"
jq -e '.experimental.evals == "./evals"' .claude-plugin/plugin.json >/dev/null ||
  fail RS-MANIFEST-057 ".claude-plugin/plugin.json#experimental.evals" "does not declare ./evals, so the shipped suite is never discovered" "set experimental.evals to ./evals"

# A `references/x.md` §"Heading" pointer that names no heading sends the agent to look for a
# section that isn't there. /review carried one for as long as the citation existed: it pointed
# at "don't over-report", which is a bullet inside "Adversarial review, not echo chamber".
python3 - >&2 <<'ANCHORS' || fail RS-SKILL-074 "skills/*/SKILL.md reference anchors" "a skill cites a section heading that does not exist in its bundled reference — the offender is printed above" "fix the citation, or add the section; a dangling anchor sends the agent looking for text that is not there"
import re, pathlib, sys
bad = 0
for sk in sorted(pathlib.Path("skills").iterdir()):
    f = sk / "SKILL.md"
    if not f.exists():
        continue
    for m in re.finditer(r'references/([a-z0-9/-]+\.md)`?\s*§\s*(?:"([^"]+)"|([A-Za-z][\w \-/]*))',
                         f.read_text(encoding="utf-8")):
        ref = m.group(1)
        sec = " ".join((m.group(2) or m.group(3) or "").split()).rstrip('.,;)')
        target = sk / "references" / ref
        if not target.exists():
            print(f"{f}: cites {ref}, which is not bundled"); bad += 1; continue
        heads = [h.strip().strip('"').lower()
                 for h in re.findall(r'^#{1,4}\s*(.+)$', target.read_text(encoding="utf-8"), re.M)]
        if not any(sec.lower() in h for h in heads):
            print(f"{f}: cites {ref} section {sec!r}, which has no such heading"); bad += 1
sys.exit(1 if bad else 0)
ANCHORS

# Why this gate exists (first-party warrant, not a benchmark claim about catalog-size
# degradation — no cited paper actually measures that for this setup): Anthropic,
# "Effective context engineering for AI agents" (2025-09-29): "If a human engineer can't
# definitively say which tool should be used in a given situation, an AI agent can't be
# expected to do better." A description pair scoring high on lexical overlap with no
# stated boundary is that failure mode made measurable: nothing tells the agent — or a
# human skimming the catalog — which of the two to reach for.
#
# Two free parameters below, each justified independently of which pairs it happens to
# flag (an earlier version of this gate picked both post hoc, after seeing that they
# landed on exactly the four pairs someone was willing to fix — that version is what this
# comment and the code under it replace):
#
# - Stopwords: generic English, plus any content word whose document frequency across the
#   catalog exceeds DF_THRESHOLD (computed from the catalog itself below, not a hand-picked
#   word list). Only "rust" clears that bar (50/62 descriptions, 80.6%); the next-highest
#   content word is "code" at 9/62 (14.5%) — a wide gap, so any cutoff between roughly 15%
#   and 80% picks the same single word. "rust" is the catalog's own name and carries zero
#   discriminative value, the same reasoning that already excludes "a"/"the". Words that
#   were previously hand-excluded to dodge specific pairs ("claude", "running", "fmt",
#   "gate", "gates") do not clear this bar (each <= 6.5% document frequency) and are back
#   in the comparison.
# - Threshold: Jaccard >= 0.20 over content words, unchanged from the original
#   calibration — kept as an ordinary "more than incidental overlap" bar for short
#   bag-of-words comparisons, not re-picked to fit this pair set. Restoring the
#   hand-picked stopwords above nearly doubled the pairs scoring over threshold (4 -> 7);
#   the threshold was not raised to compensate.
#
# A pair above the threshold is fine IF both sides carry a "## When NOT this skill"
# section naming the other, OR the pair is a documented EXCEPTIONS entry below AND
# today's actual overlap words are still a subset of the specific boilerplate words the
# entry names. That second condition matters: an exception is keyed to *why* the score is
# high, not just to the pair. If either description later picks up a shared word outside
# that boilerplate set — real subject-matter overlap, not incidental phrasing — the
# exception stops covering the pair and this gate goes back to requiring a boundary
# section, exactly as if the exception did not exist. The defect this gate catches is a
# confusable pair with nowhere to resolve the confusion.
python3 - >&2 <<'BOUNDARIES' || fail RS-SKILL-075 "skills/*/SKILL.md#description" "two descriptions are confusable with no boundary stated between them — the pair is printed above" "state the boundary in one of the two descriptions; the router picks by description alone"
import re, pathlib, sys
from itertools import combinations
from collections import Counter

GENERIC_STOPWORDS = {
    "a","an","the","and","or","of","in","on","at","to","for","with","without","from","by","as",
    "is","are","was","were","be","been","being","this","that","these","those","it","its","into",
    "use","uses","using","used","when","one","then","than","via","per","not","no","never",
    "before","after","across","through","during","over","under","up","down","out","off","again",
    "so","if","but","because","while","about","against","between","each","other","some","such",
    "own","same","just","can","will","would","should","may","might","must","do","does","did",
}

DF_THRESHOLD = 0.5  # a content word in more than half the catalog carries no discriminative signal
THRESHOLD = 0.20    # unchanged from the original calibration — see comment above

# Documented exceptions: pair scores over THRESHOLD but the overlap is shown to be
# lexical (shared boilerplate/catalog-name words), not shared subject matter. Each entry
# names the exact words that make up today's overlap ("boilerplate_words") — the
# exception applies only while the pair's actual overlap is still a subset of that set
# (checked below), so it cannot silently swallow a future real collision between the same
# two skills.
EXCEPTIONS = {
    frozenset({"eval-agents", "progress-bar"}): {
        "reason": (
            "both are Claude-Code-only utility skills that open with the same host "
            "qualifier — 'Use when running Claude Code...' — plus 'studio' from 'Rust "
            "Code Studio'. eval-agents benchmarks reviewer/auditor agents against "
            "planted defects; progress-bar configures a terminal status line. Strip the "
            "boilerplate and the intersection is empty: no shared subject matter, and no "
            "user request could plausibly land on the wrong one of the two."
        ),
        "boilerplate_words": frozenset({"claude", "code", "running", "studio"}),
    },
}

def raw_content_words(desc):
    toks = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", desc.lower())
    return {w for w in toks if w not in GENERIC_STOPWORDS and len(w) > 1}

def boundary_section(text):
    m = re.search(r'^## When NOT this skill\n(.*?)(?=\n## |\Z)', text, re.M | re.S)
    return m.group(1) if m else None

raw = {}
for sk in sorted(pathlib.Path("skills").iterdir()):
    f = sk / "SKILL.md"
    if not f.exists():
        continue
    text = f.read_text(encoding="utf-8")
    m = re.search(r'^description:\s*"?(.*?)"?\s*$', text, re.M)
    raw[sk.name] = {
        "words": raw_content_words(m.group(1) if m else ""),
        "boundary": boundary_section(text),
    }

# Document-frequency stopwords, derived from the catalog rather than hand-picked.
N = len(raw)
df = Counter()
for d in raw.values():
    for w in d["words"]:
        df[w] += 1
DF_STOPWORDS = {w for w, c in df.items() if c / N > DF_THRESHOLD}

skills = {name: {"words": d["words"] - DF_STOPWORDS, "boundary": d["boundary"]} for name, d in raw.items()}

def names(boundary, other):
    return boundary is not None and re.search(r"`/" + re.escape(other) + r"`", boundary)

bad = 0
for a, b in combinations(sorted(skills), 2):
    wa, wb = skills[a]["words"], skills[b]["words"]
    if not wa or not wb:
        continue
    score = len(wa & wb) / len(wa | wb)
    if score < THRESHOLD:
        continue
    exc = EXCEPTIONS.get(frozenset({a, b}))
    if exc and (wa & wb) <= exc["boilerplate_words"]:
        continue  # today's overlap is still only the documented boilerplate words
    missing = [s for s, o in ((a, b), (b, a)) if not names(skills[s]["boundary"], o)]
    if missing:
        print(f"/{a} ~ /{b} ({score:.3f}): {' and '.join('/' + m for m in missing)} "
              f"lack a \"## When NOT this skill\" section naming the other")
        bad += 1
sys.exit(1 if bad else 0)
BOUNDARIES

# Script-safety gate: a January-2026 scan of 31,132 marketplace skills found 26.1% carried at
# least one vulnerability, and skills shipping executable scripts were 2.12x more likely to
# have one — and no publisher-trust mechanism exists for skills. This plugin ships 16 hook
# scripts, 5 build scripts, and 4 bundled into skills; to an installer it looks like every
# other plugin in that scan. Measured on this tree: shipped hooks carry zero eval(, zero
# `new Function`, zero fetch(, zero network URLs. This gate locks in that already-true
# property across four classes so a future change can't quietly reintroduce one:
#   1. network reachable from a hook (fetch/http(s)/curl/wget in hooks/scripts/*.ts)
#   2. dynamic code execution (eval(/new Function) anywhere in a shipped script
#   3. curl-pipe-to-shell outside the one declared installer, scripts/env-setup.sh
#   4. process spawning outside hooks/scripts/_lib.ts's timeout-guarded run() helper
# It checks exactly these four literal patterns and nothing else — see README.md's "Script
# safety gate" section for what that does and does not prove.
python3 - >&2 <<'SCRIPTSAFETY' || fail RS-SCRIPT-033 "shipped scripts" "a script violates the script-safety gate — the failing class is printed above" "fix the script named above; the gate detail is in the python block in this script"
import re, sys
from pathlib import Path

bad = 0
def violate(msg):
    global bad
    print(msg)
    bad += 1

# --- 1. network from a hook --------------------------------------------------------------
# A hook fires on every matching tool call with no user prompt in the loop; one that could
# reach the network could exfiltrate anything it reads (repo contents, memory notes, env).
hook_files = sorted(p for p in Path("hooks/scripts").glob("*.ts") if not p.name.endswith(".test.ts"))
net_re = re.compile(r'fetch\(|https?://|\bcurl\b|\bwget\b')
for f in hook_files:
    for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if net_re.search(line):
            violate(f"[network-from-hook] {f}:{i}: {line.strip()}")

# --- 2. dynamic execution -----------------------------------------------------------------
# eval/new Function run an arbitrary string as code, the one primitive no static review can
# bound. This validator's own source is excluded — it names these patterns to check for them.
def shipped_scripts():
    paths = list(Path("hooks/scripts").glob("*.ts"))
    paths += list(Path("scripts").glob("*.ts"))
    paths += list(Path("scripts").glob("*.mjs"))
    paths += list(Path("scripts").glob("*.sh"))
    paths += [p for p in Path("skills").glob("*/scripts/*") if p.suffix in (".ts", ".mjs", ".sh")]
    return sorted(set(p for p in paths if p.as_posix() != "scripts/validate-distribution.sh"))

all_scripts = shipped_scripts()
dyn_re = re.compile(r'\beval\(|new Function\b')
for f in all_scripts:
    for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if dyn_re.search(line):
            violate(f"[dynamic-exec] {f}:{i}: {line.strip()}")

# --- 3. curl | sh ---------------------------------------------------------------------------
# Piping a network download straight into an interpreter runs whatever the remote end serves
# today, no matter what was audited yesterday. scripts/env-setup.sh is the single declared
# exception: a user-invoked installer that bootstraps rustup this way on purpose. Its
# skills/env-setup/ mirror is kept byte-identical by sync-references.sh --check (below), so
# the exception is matched by filename rather than one hardcoded path.
pipe_re = re.compile(r'curl\b[^\n|]*\|\s*(sh|bash)\b')
for f in all_scripts:
    if f.name == "env-setup.sh":
        continue
    for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if pipe_re.search(line):
            violate(f"[curl-pipe-sh] {f}:{i}: {line.strip()}")

# --- 4. process spawning --------------------------------------------------------------------
# Every hook is meant to funnel subprocess calls through hooks/scripts/_lib.ts's run() helper:
# Bun.spawnSync on an argv array (no shell, so no injection surface) with a timeout (default
# 8s) so a stuck child can't hang the session. Two real exceptions exist today, both inside
# memory-store.ts, both with their own 2s timeout: gitMainRoot() (~line 43) runs a fully
# literal `git rev-parse --git-common-dir`, and gitSignal()'s git() closure (~line 421-434)
# runs an *interpolated* `git ${args}` — every call site passes a hardcoded string literal,
# never external/session-derived input. A literal raw call just needs its own timeout to
# pass; an interpolated one must additionally be registered below — that registration is the
# "where does this argument come from" comment, kept here since memory-store.ts is out of
# scope for this change. Anything else must move to the run() helper.
spawn_re = re.compile(r'Bun\.spawnSync\(|Bun\.spawn\(|execSync\(|execFileSync\(|\bspawnSync\(|\bexecFile\(')
KNOWN_INTERPOLATED_EXCEPTIONS = {
    # file, exact call fragment: args are all hardcoded literals inside gitSignal()'s own
    # body (rev-parse/log/diff subcommands) -- never user or session input.
    ("hooks/scripts/memory-store.ts", 'execSync(`git ${args}`'),
}
lib_lines = Path("hooks/scripts/_lib.ts").read_text(encoding="utf-8").splitlines()
lib_timeout_ok = False
for i, line in enumerate(lib_lines):
    if "Bun.spawnSync(" in line:
        lib_timeout_ok = "timeout" in "\n".join(lib_lines[i:i + 10])
        break
if not lib_timeout_ok:
    violate("[spawn] hooks/scripts/_lib.ts: run() helper no longer sets a spawn timeout")

for f in hook_files:
    if f.name == "_lib.ts":
        continue
    rel = f.as_posix()
    lines = f.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines, 1):
        if not spawn_re.search(line):
            continue
        has_timeout = "timeout" in "\n".join(lines[max(0, i - 1):i + 5])
        interpolated = "${" in line and "`" in line
        if interpolated:
            registered = any(rel == exc_file and exc_pat in line for exc_file, exc_pat in KNOWN_INTERPOLATED_EXCEPTIONS)
            if not (registered and has_timeout):
                violate(f"[spawn] {rel}:{i}: interpolated command string outside _lib.ts's "
                        f"run() helper and not a registered, timed exception: {line.strip()}")
        elif not has_timeout:
            violate(f"[spawn] {rel}:{i}: process spawn outside _lib.ts's run() helper has no timeout: {line.strip()}")

sys.exit(1 if bad else 0)
SCRIPTSAFETY

# --- relayed-verdict contract ------------------------------------------------------
# A skill that names a studio agent will receive a verdict from it, and the one edit that
# turns a gate result into an opinion is folding that verdict into the orchestrator's own
# summary. The rule lives in docs/verdicts.md; this check is that the rule is REACHABLE from
# every skill it binds — a skill installed on its own carries only its own references/.
python3 - >&2 <<'VERDICTREACH' || fail RS-SKILL-077 "skills/*/references/verdicts.md" \
  "a skill names a studio agent but cannot reach the relayed-verdict contract — the offender is printed above" \
  "cite references/verdicts.md from the skill, or from a doc it already bundles (docs/sub-agents.md reaches 54 of them), then run ./scripts/sync-references.sh"
import pathlib, sys
agents = {p.stem for p in pathlib.Path("agents").glob("*.md")}
bad = []
for sk in sorted(pathlib.Path("skills").glob("*/SKILL.md")):
    text = sk.read_text()
    if not any(f"`{a}`" in text for a in agents):
        continue
    if not (sk.parent / "references" / "verdicts.md").exists():
        bad.append(sk.parent.name)
for b in bad:
    print(f"  {b}: names a studio agent, no references/verdicts.md in its bundle", file=sys.stderr)
sys.exit(1 if bad else 0)
VERDICTREACH

# Both sub-checks report on stdout. Capture it so --json keeps stdout to one object, and
# so a failure arrives as a finding with the drift folded in rather than as loose text.
if ! sync_out=$(node scripts/generate-openai-metadata.mjs --check 2>&1); then
  fail RS-SKILL-076 "skills/*/agents/openai.yaml" \
    "OpenAI metadata is out of sync with the skills: ${sync_out//$'\n'/; }" \
    "run node scripts/generate-openai-metadata.mjs"
fi
say "$sync_out"

if ! ref_out=$(./scripts/sync-references.sh --check 2>&1); then
  fail RS-REF-110 "skills/*/references/" \
    "bundled references are stale against docs/ and rules/: ${ref_out//$'\n'/; }" \
    "run ./scripts/sync-references.sh"
fi
say "$ref_out"

if (( JSON )); then
  printf '{"ok":true,"skills":%s,"descriptionChars":%s,"evalCases":%s,"version":"%s"}\n' \
    "$skill_count" "$description_chars" "$eval_cases" "$codex_version"
else
  echo "distribution valid: $skill_count skills, $description_chars description characters, $eval_cases eval cases, version $codex_version"
fi
