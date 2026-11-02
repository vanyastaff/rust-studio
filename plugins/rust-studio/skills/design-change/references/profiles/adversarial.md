# Adversarial analysis

Use to challenge a design, premise or apparently clean result. Read the request, governing
spec/ADRs and `references/integrity-and-evidence.md` before constructing an
attack. Verify negative claims by direct search and positive claims by reading the body.
Label sampled/unread evidence as a lead and explicitly retract a disproved finding.

State the load-bearing premise, then construct concrete failures: partial progress,
cancellation, hostile input, scale, a second caller and the next refactor. Compare the design
with every acceptance criterion, including lifecycle recovery, symmetric paths, missing
error states, enforceable invariants and observability.

Attack evidence too: vacuous/self-confirming tests, uncalibrated oracles, hidden denominators,
skipped gates and invisible worst-case bounds. Hidden clock/random/environment/network reads
need deterministic seams when they prevent required testing. Compare two or three materially
different decompositions where a real design fork exists; distinguish essential complexity
from complexity introduced by the proposal.

Report premise, failure scenarios, missing evidence and alternatives. Keep extra product
requirements explicitly optional. Use SURVIVES with required changes, DOESN'T SURVIVE with
the supported alternative, or INSUFFICIENT INFO with the evidence needed next. Critique is
not permission to expand scope or a substitute for correctness and acceptance verification.
