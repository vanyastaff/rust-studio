---
kind: skill
target: refactor
allowed_tools: [Read, Edit, Write, Glob, Grep, Bash, Agent, Skill]
max_turns: 60
timeout_seconds: 1800
---
Nobody on the team can follow `apply_discount` in src/lib.rs of the crate `acme-billing` (current directory) any more. Make it readable for a human. Behavior must stay exactly identical — including error messages, the returned totals, the `coupon_uses` side effect, and the `println!` — and the public signatures of `apply_discount` and `Order` must not change (other code in the workspace calls them as-is). There is no user available to answer prompts, so treat the skill's approval gates as answered in advance: scope = the whole of `apply_discount` and any private helpers you extract; the invariants are the ones just stated; the plan is pre-approved provided each step keeps the gate green. The project has no justfile/Makefile/CI, so the studio defaults are the gate. Run every phase yourself where a named sub-agent is unavailable. Do not commit. Finish with the skill's Phase 7 report and verdict.
