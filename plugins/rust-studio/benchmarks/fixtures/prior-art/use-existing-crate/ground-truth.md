# Ground truth — prior-art/use-existing-crate (verdict: RESHAPE NEEDED)

Pre-code gate question: "which sibling/ecosystem crate already owns this?" Both
primitives were reinvented without a prior-art survey.

| id   | line | type       | severity | defect |
|------|------|------------|----------|--------|
| GT-1 | 7    | REINVENTED | 🟣 | Hand-rolled hex encoder. The `hex` crate (or a workspace util) already does this correctly and faster — reuse it instead of maintaining a bespoke encoder. |
| GT-2 | 24   | REINVENTED | 🟣 | Bespoke exponential-backoff retry with no jitter, no cap, and a unit error. The workspace ships `acme-resilience` for retry/backoff — survey siblings and reuse it. |

Pass = the agent returns **RESHAPE NEEDED / REDO-TO-BAR**: survey siblings + ecosystem
and reuse the mature solution rather than hand-rolling. Reinventing a sibling/ecosystem
primitive is a Maintainer Rejection Test failure — accepting the hand-rolled code is the miss.
