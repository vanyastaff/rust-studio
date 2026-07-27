# Coordination Protocol — Gates, Verdicts, Evidence

How work is checked and how it reports. Part of the
Coordination Protocol (`coordination-protocol.md`); see also `collaboration.md` (autonomy,
when to ask) and `delegation.md` (team, tiers, team execution).

---
## 4. Quality gates

Gates are checkpoints a lead (or director) must clear before work proceeds. Each
gate has an ID so it can be referenced in stories and reviews.

| Gate ID         | Owner               | Checks |
|-----------------|---------------------|--------|
| `ARCH-GATE`     | chief-architect     | Module/crate boundaries sound; ADR exists for non-trivial design; no layering violations. |
| `SCOPE-GATE`    | product-steward     | Diff/plan matches acceptance criteria; over-scope/under-scope flagged; non-goals stated. |
| `API-GATE`      | api-design-lead     | Public items documented; semver impact understood; `#[non_exhaustive]`/sealed where needed; no accidental pub. |
| `ASYNC-GATE`    | async-systems-lead  | No blocking in async; cancellation-safe; `Send`/`'static` bounds correct; backpressure considered. |
| `CLI-GATE`      | cli-ux-lead         | Exit codes correct; stdout=data / stderr=diagnostics; `--help` complete; errors actionable. |
| `PERF-GATE`     | systems-perf-lead   | Hot paths allocation-aware; benchmarked before/after; no needless clones; complexity justified. |
| `SAFETY-GATE`   | systems-perf-lead + unsafe-auditor | Every `unsafe` has a `// SAFETY:` invariant; miri-clean where feasible; no UB. |
| `QA-GATE`       | qa-lead             | Tests cover acceptance criteria + edge cases; no flaky tests; coverage not regressed. |
| `RELEASE-GATE`  | release-lead        | Version bumped per semver; changelog updated; MSRV verified; `cargo publish --dry-run` clean. |
| `BUILD-GATE`    | tooling-lead        | Builds on all feature combinations + targets; CI green; no warnings. |

`docs-engineer` contributes to `API-GATE` (pub items documented, doc-tests pass) and
`RELEASE-GATE` (README/CHANGELOG in sync); the owning lead still signs off.

### Review modes

Intensity moves **one** axis — how many independent lenses read the change. It never moves
the other. Keeping these apart is the whole design:

| | **Ceremony** (scales with intensity) | **Integrity floor** (never scales) |
|---|---|---|
| What it is | How many reviewers, phases, and gates run | The evidence rules and the Cheat Catalog (`integrity-and-evidence.md`) |
| Why it exists | Cost and latency should match blast radius | A green that was not earned is a defect at any speed |

The session briefing names the active intensity (default **full**). Pick it to match the
work, and say which one you are running under:

- **full** — every relevant gate runs by its owning lead; `/review` fans out its multi-lens
  pass. For public APIs, `unsafe`, releases, and anything crossing crates.
- **lean** — only the directly-relevant gate(s) run, one reviewer pass, no `harsh-critic`
  unless the change embeds a design call. For routine features inside one crate.
- **solo** — gates are advisory and `rust-reviewer` does a single pass. For prototypes and
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

Multi-agent skills (the `team-*` family, `dev-task`, `review`) end with an explicit
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

**The verdict supplements the deliverable; it never replaces it.** A sub-agent's final message is
what the caller receives — put the actual deliverable (code map, digest, findings, answer) there
in full and add the verdict as a trailing line. Never close with a verdict-only "I did the work"
summary while the content sits in an earlier message: the caller then gets only the verdict and
must dig the deliverable out of the output file. The `SubagentStop` hook enforces this — it nags
**only** studio agents that owe a verdict (built-in/non-studio agents like `Explore` or
`claude-code-guide` return data and are left alone), and its reminder says *append*, not replace.

---
## 7. Evidence over assertion

Claims about correctness or performance must be backed by command output:
- "tests pass" → paste the `cargo test` / `cargo nextest` summary.
- "faster" → paste criterion's before/after.
- "clippy-clean" → `cargo clippy --all-targets --all-features -D warnings` exit 0.
- "no UB" → `cargo +nightly miri test` output (where feasible).

If something was skipped, say so. Never substitute "probably" for checking.

---
