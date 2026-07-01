# Ground truth — workspace/full-ripple (verdict: RESHAPE NEEDED)

A change to a shared `acme-core` enum must ripple to EVERY workspace member. One
consumer was updated; the other compiles but silently mishandles the new case.

| id   | line | type              | severity | defect |
|------|------|-------------------|----------|--------|
| GT-1 | 31   | INCOMPLETE-RIPPLE | 🔴 | `acme-worker::dispatch` still has a catch-all `_ => Ok(())` that silently drops the new `Job::Push` — jobs are accepted and never sent. The cross-crate change did not update this member. |
| GT-2 | 31   | DESIGN            | 🟠 | The `_` catch-all is what HID the missing case from the compiler. Prefer an exhaustive match (no wildcard) — or `#[non_exhaustive]` with deliberate handling — so the next variant is a compile error, not a silent drop. |

Pass = the agent returns **RESHAPE NEEDED**: the enum change must update all members
(GT-1), and it flags the wildcard arm as the reason the gap stayed green (GT-2).
Treating "it compiles" as done is the miss.
