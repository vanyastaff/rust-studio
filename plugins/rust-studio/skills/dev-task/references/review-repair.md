# Close a review with bounded, focused repairs

Applies to `/dev-task` after its first spec-compliance or code-quality review, including
tasks driven by `/spec-tasks`. Initial review still covers the whole authorized change.
Standalone `/review` remains read-only; a finding is not authorization to start repairs.

## Record the decision before dispatch

Give findings stable IDs and a disposition: **blocking**, **advisory**, **resolved**, or
**disputed**, with evidence and a reason. Required behavior, safety, integrity and applicable
quality-gate failures cannot be relabelled advisory to finish. Severity words alone do not
route work: an explicitly advisory recommendation labelled Important is not a repair order.
A COMPLETE verdict alongside an unresolved blocker is inconsistent; preserve the quoted
verdict and report NEEDS WORK until resolved. Settle factual disputes with a focused probe;
escalate genuine scope/requirement decisions.

Keep one record in the existing durable task/plan note; for a spec, use the task's entry in
`tasks.md`. If a standalone task has no durable note, use
`.rust-studio/tasks/<task-slug>.md`. Record identity, approved scope, original review/finding
IDs, source/destination tree identities, repair count, evidence and open/advisory findings.
It is not a second status database. Update it **before** each repair dispatch so interruption
cannot erase an attempted round.

## Repair, verify, then decide

- **At most three repair dispatches per task**, shared across both review stages. One
  dispatch to implement fixes counts as a round, including mechanical failures inside that
  attempt. Do not apply the pre-review retry allowance to review repairs. Worker replacement, switching
  stages, interruption or wider review never resets the count. Verification after repair
  three is allowed; a fourth repair is not automatic.
- Within the same approved task, resume its implementer with actionable findings and current
  tree identity when the context remains usable. Start fresh when it is unavailable,
  stale/contaminated, or scope needs a different brief; carry the record and count across.
  The implementer never signs off its repair. A fresh **task** still gets a fresh context.
- Send only blocking fixes to the implementer. Before replacing a branch/guard, name the
  boundary input or state the original protected. Use the producer/caller contract,
  invariant, characterization test or trace to show required behavior is preserved. A
  shorter expression or happy-path green is not proof; unknown input validity requires
  investigation, not accepting the suggestion as fact.
- Independent re-review receives original findings, prior reviewed revision, repair diff,
  relevant surrounding contracts/code and current evidence. It checks addressed/unaddressed
  findings and new defects introduced by the repair. Tracing affected callers is allowed;
  focused review does not exclude needed context. Unrelated discoveries become follow-ups,
  not an automatic new sweep or fix queue.
- Refresh acceptance tests and **every earlier gate affected by the repair**, even within
  unchanged scope: a code-quality fix can break spec compliance. Run focused regressions
  and the final required project gate against the destination tree. Expand relevant review
  when scope, interfaces or blast radius changes, or the user requests it; record why and
  keep the same repair budget. A new commit alone is not that trigger.
- Stop automatic repair at the limit, or after two consecutive rounds with no new evidence
  and the same unresolved blockers. Keep completed work, findings, commands and next decision.
  Return NEEDS WORK (or BLOCKED for a missing prerequisite), never completion because the
  budget ended. An explicit revised mandate may authorize further work; silence or a new
  context cannot. Other independent ready tasks may continue.

Close when all required findings and current gates pass. Retain advisory items and reasons
for changed dispositions. Do not repeat a broad review just to review an already reviewed
repair. Ordinary spec/user acceptance checks, including required independent acceptance,
still govern completion.
