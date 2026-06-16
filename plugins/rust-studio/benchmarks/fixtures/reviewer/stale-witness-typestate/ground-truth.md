# Ground truth — reviewer/stale-witness-typestate (agent: rust-reviewer)

Mode: **defect-recall**. The typestate is half-right — the private field makes unvalidated
dispatch unrepresentable — which is exactly why the remaining bug is easy to wave through:
the witness *looks* authoritative. A reviewer must see that the proof has no binding to what
it proves.

| id   | line | type                          | severity | defect |
|------|------|-------------------------------|----------|--------|
| GT-1 | 41   | SOUNDNESS (stale proof)       | 🔴 | `Validated` stores only the `WorkflowDef`, with no binding to the `ActionRegistry` it was checked against — no registry version, epoch, or snapshot. The fact it asserts ("every action exists") can be falsified after construction while the type keeps asserting it. Bind the witness to a registry version (re-check on mismatch), borrow the registry for the witness's lifetime so it cannot change, or re-validate at dispatch. |
| GT-2 | 67   | TOCTOU (reuse after mutation) | 🟠 | `example` validates, then mutates the registry (`unregister`), then reuses the **same** `Validated` — a time-of-check/time-of-use gap. `dispatch` trusts the witness and never re-checks, so it runs against a now-invalid registry. The typestate hid the bug by making the stale value look proven. |

Pass = both caught: the witness records nothing about the registry it was validated against
(so the proof can go stale), and the validate→mutate→reuse path that triggers it. Catching
only "looks fine, the private field is good design" is a miss — the soundness hole is the point.
