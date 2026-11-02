# Claude Code compatibility notes

Re-checked **2026-11-01** against the official [changelog](https://code.claude.com/docs/en/changelog),
[subagent reference](https://code.claude.com/docs/en/sub-agents), and
[plugin loading reference](https://code.claude.com/docs/en/plugins/loading).
The filename remains stable for existing references. This is host compatibility guidance,
not a claim that one model generation has fixed behavior across providers or effort settings.

## Recent changes that affect Studio

- **Subagent effort:** the October 31 changelog adds `CLAUDE_CODE_SUBAGENT_EFFORT` as the
  default when no other source selects the subagent's effort. Report it in `/inspect-project --mode diagnose-host`;
  keep the value user-owned and measure each model/effort combination separately.
- **Effort keywords:** the October 26/31 entries make `ultrathink` an active `xhigh` control
  on supported surfaces/models and add `CLAUDE_CODE_DISABLE_ULTRATHINK`. Earlier Studio prose
  saying the keyword does nothing is obsolete. Keep effort keywords out of reusable workflows
  so invoking a skill does not silently change the user's effort choice.
- **Model inheritance:** the current reference places a per-call override before agent
  frontmatter, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. Explicit `model: inherit`
  selects the main conversation and therefore outranks the environment default. The force
  variable changes that order; see `model-routing.md` for the exceptions and diagnostics.
- **Lifecycle fixes:** the October 26 changelog fixes repeated `SubagentStop` delivery,
  premature removal of a worktree used by a descendant, and stale instruction/memory reads
  after compaction. These are host fixes; add compensating behavior only after reproducing a
  remaining failure on the installed host.
- **Windows hooks:** the October 31 changelog fixes PowerShell hook exit-code handling.
  Check the installed host version and actual hook output when a guard appears ineffective.

## Installation is different from activation

Plugin settings, cached files and components loaded in the session are distinct layers.
`claude plugin update` updates disk state. `/reload-plugins` reloads hooks, MCP and LSP
components; monitors require a session restart. `/reload-skills` alone does not activate all
plugin changes. Inspect the loaded version and run a delivery probe before reporting success.
Studio includes monitors, so report a pending restart when updating a running installation.

The terminal CLI and an embedded desktop host can have different versions. Record the one
being diagnosed. A successful manifest validation proves packaging, not event delivery or
model behavior.

## Instructions to keep out of agents and skills

- Repeated generic demands to verify: name the relevant acceptance evidence and project gate.
- Hardcoded provider model IDs, default effort claims, or unmeasured model rankings: route
  through user settings and record the model used for an eval.
- Requests for hidden reasoning: ask for findings, conclusions and checkable evidence.
- Blanket verbosity or formatting bans: specify the deliverable and its useful level of detail.
- Fixed recipes for open design decisions: state contracts and scope; retain exact steps only
  for operations whose order affects correctness.
- Automatic publication or unrelated configuration changes: preserve the user's authorized scope.

## Behaviors worth steering explicitly

Keep the scope, consumer migration, completion evidence and useful progress updates explicit.
Independent review has value when another reader can test a consequential design decision;
it is not a requirement to spawn workers for every task. Respect the active host's delegation
policy and use the inline fallback when workers are unavailable.

Keep one source of truth for durable rules and load specialized references when applicable.
The Studio gates are project policy, not conclusions about a model's psychology. Validate prompt
changes against realistic fixtures; report a refused, unavailable or unrun eval as unmeasured.

## Model policy

The shipped roster uses role aliases and `inherit`; provider IDs and effort remain user-owned.
Inspect the actual selected model when a gate's quality depends on routing, including overrides,
force settings, provider availability and organization restrictions. A refused security review
is incomplete evidence. Report the refusal or host fallback and keep ordinary security review
focused on the authorized code.

The release changelog includes model additions and retirements, but those do not establish
availability for a particular account. Refresh official model configuration when changing a
routing map instead of embedding a dated model catalog in every agent prompt.
