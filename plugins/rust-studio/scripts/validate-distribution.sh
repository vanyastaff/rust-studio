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
expected_claude_only=$'/auto-capture.ts\n/model-switch.ts\n/statusline-install.ts\n/subagent-start.ts\n/subagent-stop.ts'
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
    add-dep|commit|eval-agents|migrate|new-crate|pr|progress-bar|publish|worktree-sweep) expected=1 ;;
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
python3 - <<'AGENTFRONTMATTER' || fail "an agent brief's frontmatter violates the agent frontmatter gate — see the class named above"
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

# A `references/x.md` §"Heading" pointer that names no heading sends the agent to look for a
# section that isn't there. /review carried one for as long as the citation existed: it pointed
# at "don't over-report", which is a bullet inside "Adversarial review, not echo chamber".
python3 - <<'ANCHORS' || fail "a skill cites a section that does not exist in the bundled reference"
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
python3 - <<'BOUNDARIES' || fail "two skills have confusable descriptions and no boundary between them"
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
python3 - <<'SCRIPTSAFETY' || fail "a shipped script violates the script-safety gate — see the class named above"
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

node scripts/generate-openai-metadata.mjs --check
./scripts/sync-references.sh --check

echo "distribution valid: $skill_count skills, $description_chars description characters, $eval_cases eval cases, version $codex_version"
