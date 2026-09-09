# Upstream workflow review — 2026-09-09

Read public commits, source and issue discussions from both projects. Issue reports are
failure hypotheses, not locally reproduced runtime bugs. No upstream issue was modified.
The selected changes adapt existing workflows; they add no new skill, agent or runner.

## Source snapshot

- [mattpocock/skills HEAD](https://github.com/mattpocock/skills/commit/3cca18b368ae95cdbdebbff572ccafa662551015),
  September 4: reviewed recent commits and the in-progress retro/implement-spec skills.
- [obra/superpowers HEAD, v6.3.0](https://github.com/obra/superpowers/commit/b36e0829c6d0140e93cfef2ca599b1b07d4a7797),
  August 12: reviewed v6.2/v6.3 workflow changes and current templates.
- Issues and comments were refreshed through GitHub's API on September 9, including
  reports updated that day. These are dated observations, not a continuing watch.

## Adopted

| Evidence | Local change | Behavioral case |
|---|---|---|
| Matt [final review handoff](https://github.com/mattpocock/skills/commit/5b15a47f2d7150f545fbcacbfe381787fc0230dc), [#1014](https://github.com/mattpocock/skills/issues/1014); Superpowers [repair lifecycle](https://github.com/obra/superpowers/commit/ebdd4ec61f2f560bada4f6ded7b0806e62bf33f7), [#2273](https://github.com/obra/superpowers/issues/2273) | `review-repair.md`: focused re-review, one persisted three-dispatch budget, blocker/advisory reconciliation, affected earlier gates rechecked. The three-dispatch rule is our choice, not an upstream default. | `repair-loop-closeout` |
| Superpowers v6.3 producer/consumer preflight and [#2267](https://github.com/obra/superpowers/issues/2267); Matt [#508](https://github.com/mattpocock/skills/issues/508) and comments | `task-continuity.md`, task template and `/spec-tasks`: retain discoveries, reconcile interface semantics, verify the actual integration destination before dependent work, distinguish local completion from remote merge. | `task-resume-evidence` |
| Matt [retro information access](https://github.com/mattpocock/skills/commit/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76) | `/session-wrap`: zero to three improvements justified by observed friction, a cause or explicit hypothesis, the smallest change and validation. Prefer useful local diagnostics over broader access or global instruction growth. | `session-retro-evidence` |
| Matt [#1044](https://github.com/mattpocock/skills/issues/1044), [#1065](https://github.com/mattpocock/skills/issues/1065) | `/review`: discover actual applicable standards; require boundary-state and producer-contract evidence before recommending a guard/branch replacement. Unknown input validity remains a hypothesis. | `review-guard-preservation` |

The two Superpowers issue reports above describe older installed versions. Current source
was inspected for relevant gaps, but we did not reproduce their full host sessions.

## Already covered or deferred

- Matt [#1060](https://github.com/mattpocock/skills/issues/1060): prior blind acceptance and
  integrity checks already cover lost user criteria and self-confirming tests. Keep one system.
- Matt [#1056](https://github.com/mattpocock/skills/issues/1056): a host-specific direct-command
  report does not justify removing explicit-only invocation metadata without reproduction.
- Superpowers batching and brainstorming routes overlap existing task sizing, handoff
  economics and fast paths. Do not add a second router or renewed approval ceremonies.
- Matt's latest link-script housekeeping does not address our bundle synchronization.
  No upstream scripts were executed or copied into the plugin.

## Verification scope

The four cases adjudicate supplied records; they cannot prove host isolation, persisted
state across a real crash, or end-to-end merge correctness. Compare the same frozen cases
against a snapshot containing the earlier local improvements and the updated plugin.
Inspect activation, runtime errors and individual graders, not only aggregate scores.
Generated reference copies, distribution checks, unit tests and host validators verify
packaging separately. A single behavioral run is diagnostic, not a reliability estimate.
