# Coordination Protocol — Gates, Verdicts, Evidence

How work is checked and how it reports. Part of the
Coordination Protocol (`coordination-protocol.md`); see also `collaboration.md` (autonomy,
when to ask) and `delegation.md` (roles, profiles, team execution).

---
## 4. Quality gates

Gates name the evidence required before a result can pass. Select reviewer/verifier by the
action and load every relevant domain profile; profiles are reusable, not exclusive owners.
Independent sign-off comes from a separate fresh instance, never the author of the artifact.

| Gate ID | Required expertise | Checks |
|---|---|---|
| ARCH-GATE | architecture | Sound boundaries; required ADRs; no layering violations |
| SCOPE-GATE | architecture, correctness | Requirements/non-goals match; over/under-scope reported |
| API-GATE | api, documentation | Public docs; SemVer; stability/sealing decisions; no accidental pub |
| ASYNC-GATE | async | Blocking, cancellation, bounds, backpressure and owned task lifecycle |
| CLI-GATE | cli | Exit codes, stdout/data versus stderr/diagnostics, help and actionable errors |
| PERF-GATE | performance, systems | Before/after measurements, allocations/clones and justified complexity |
| SAFETY-GATE | systems, platforms where applicable | SAFETY invariants, applicable Miri/ABI evidence, no known UB |
| QA-GATE | testing | Acceptance and failure cases, meaningful assertions, flakiness and coverage |
| RELEASE-GATE | release, dependencies, documentation | SemVer, changelog/docs, MSRV and publish dry-run |
| BUILD-GATE | tooling | Required feature/target matrix, CI and zero-warning gates |

Profile paths are in `references/agent-roster.md`; missing required expertise is an unverified
lens. An implementer authoring docs/tests cannot provide independent API/RELEASE/QA sign-off.
A fresh reviewer inspects their contracts and a fresh verifier judges command/behavior evidence.

### Review modes

Intensity moves **one** axis — how many independent lenses read the change. It never moves
the other. Keeping these apart is the whole design:

| | **Ceremony** (scales with intensity) | **Integrity floor** (never scales) |
|---|---|---|
| What it is | How many reviewers, phases, and gates run | The evidence rules and the Cheat Catalog (`integrity-and-evidence.md`) |
| Why it exists | Cost and latency should match blast radius | A green that was not earned is a defect at any speed |

The session briefing names the active intensity (default **full**). Pick it to match the
work, and say which one you are running under:

- **full** — every relevant gate uses an independent reviewer/verifier with applicable profiles; `/review-work --mode diff` fans out its multi-lens
  pass. For public APIs, `unsafe`, releases, and anything crossing crates.
- **lean** — only the directly-relevant gate(s) run, one reviewer pass, no `reviewer` with the `adversarial` profile
  unless the change embeds a design call. For routine features inside one crate.
- **solo** — gates are advisory and `reviewer` with the `correctness` profile does a single pass. For prototypes and
  throwaway spikes.

**Turning ceremony down turns the mechanical floor up.** At `full`, several independent
lenses would catch a stub, a vacuous test, or a claimed-but-unrun check. At `lean` and
`solo` those lenses are gone, so the `stop-guard` hook defaults **on** there to hold the
evidence line mechanically — an explicit `stop_guard` setting still wins. Fewer eyes is a
reason for stricter automatic enforcement, not looser.

What **never** changes with intensity: the command output behind every claim, the honest
denominator, "unverified" as a valid state, and the `🚩 INTEGRITY` verdict. `solo` buys
fewer reviewers — never permission to report a green you did not earn.

---
## 5. Verdicts

Coordinated implementation, review and verification end with an explicit
verdict so you always know where things stand:

- **COMPLETE** — work done, gates passed, evidence shown (test output, bench numbers).
- **NEEDS WORK** — specific, listed issues block completion; each has an owner.
- **REDO-TO-BAR** — the change compiles + clippy-clean + tests-green + correct, but a strict
  maintainer would reject its SHAPE: wrong crate, a reinvented sibling primitive, a
  clone-to-appease-borrowck, a stringly/bool API where a domain type belongs, a stale idiom, or
  an active-dev shim. The fix is to **reshape the TOUCHED area**, not apply line patches. It is
  merge-blocking but **blast-radius-bounded** — only code the task touched is reshaped; untouched
  code is never force-reshaped, and this verdict is **not** for speculative abstraction or
  future-proofing. The learning is kept, the junior patch is not.
- **BLOCKED** — a hard dependency is missing (e.g. an ADR, an upstream decision);
  the blocker is named with a suggested next step. Completed work is never discarded for
  NEEDS WORK.

**A relayed verdict is quoted, not paraphrased.** When a skill spawns a lens (`reviewer` with the `correctness` profile,
`reviewer` with the `adversarial` profile, `designer` with the `architecture` profile, a domain specialist), its verdict token appears verbatim in the
message the user reads, attributed to the lens, next to the orchestrator's own verdict. Dropping
it to a summary ("the reviewer flagged some issues") is the one edit that turns a gate result
into an opinion.

**The verdict supplements the deliverable; it never replaces it.** A sub-agent's final message is
what the caller receives — put the actual deliverable (code map, digest, findings, answer) there
in full and add the verdict as a trailing line. Never close with a verdict-only "I did the work"
summary while the content sits in an earlier message: the caller then gets only the verdict and
must dig the deliverable out of the output file. The `SubagentStop` hook enforces this — it nags
**only** studio agents that owe a verdict (built-in/non-studio agents like `Explore` or
`claude-code-guide` return data and are left alone), and its reminder says *append*, not replace.

---
## 7. Evidence over assertion

Claims about correctness or performance must be backed by command output — and by the command
that **governs merging** where the project owns a gate (`project-gate.md`):
- "tests pass" → paste the `cargo test` / `cargo nextest` summary.
- "faster" → paste criterion's before/after.
- "clippy-clean" → `cargo clippy --all-targets --all-features -D warnings` exit 0.
- "no UB" → `cargo +nightly miri test` output (where feasible).

Name the command behind each claim. If something was skipped, say so. Never substitute
"probably" for checking. Where the spec has an acceptance ledger, the checker's summary line
(`ACCEPTANCE … N met, M unmet, S stale, A abandoned` + `ALL MET` / `NOT MET` / `HANDOFF
REQUIRED`) is the criteria evidence, and it maps onto the verdicts directly: `NOT MET` is NEEDS
WORK, `HANDOFF REQUIRED` is BLOCKED (`acceptance-ledger.md`).

---
