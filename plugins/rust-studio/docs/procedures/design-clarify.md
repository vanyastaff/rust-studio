# Clarify requirements

Read `references/collaboration.md` before eliciting user decisions. Map the affected types,
callers, constraints, MSRV, sync/async posture and public surface first. A researcher with
the navigation profile can filter this evidence (`references/sub-agents.md`).

Build a decision tree. Mark each fork DECIDE when evidence or technical analysis resolves
it, ASK when taste, priority, risk appetite, breaking-change policy or a business constraint
belongs to the user, or DEPENDS when an earlier answer determines whether it matters.
State DECIDE outcomes with their rationale. If no ASK remains, continue authorized work.

Interview ASK forks in dependency order, one focused axis at a time. Offer concrete choices
with a recommended default, a short reason and cost if wrong, allowing a free answer. Adapt
the number of options to the host's input surface. Batch at most three only when independent
and equally cheap. After every answer recompute dependencies and resolve newly decidable
forks. Options vary scope or approach while meeting the same quality bar.

Finish when every ASK is answered or explicitly unresolved with its blocking consequence.
Write a synthesis of at most 200 words: technical decisions and rationale, user decisions
and provenance, labeled assumptions/risks, and gate or compatibility implications. The
coordinator records consequential answers in the existing context/spec under
`references/elephant-workflow.md` before review or implementation. Private conversation
cannot replace these artifacts. Interview-only work ends at the synthesis; it performs no
source edits. Preserve completed analysis when a required answer is unavailable.
