---
name: spec-verify
description: "Use to verify a Rust implementation meets an existing spec before closing it."
---

# /spec-verify — verify against the spec (verify → archive)

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Prove the work meets `.rust-studio/specs/<slug>/spec.md`.
Evidence over assertion
(`references/verdicts.md`, §7). You are the orchestrator:
**delegate writes (the verify report) to `rust-builder`**; do not write files directly.

## When NOT this skill
- You're not checking against a written spec — you want to restructure existing code
  without changing behavior → `/refactor`. `/spec-verify` only checks already-finished
  work against an existing `.rust-studio/specs/<slug>/spec.md`; it doesn't touch code.
- No spec is in play and you just need cargo fmt/clippy/tests driven green →
  `/verify-loop`: a bounded auto-fix loop with no notion of a spec. `/spec-verify` checks
  the result against a spec's acceptance criteria one by one and produces the archiving
  evidence.

## Progress visibility
Use the host's task or plan surface when available; otherwise keep a concise in-message checklist.
Create one item per step, mark the active step, and surface each result in one line before moving
on. Keep blocking steps in the foreground so the user sees intermediate evidence instead of a
final dump.

## Steps
1. Resolve the spec (`input` = slug or path; optional `--blind` requires independent
   acceptance even for a small change). Determine whether the independent pass is required
   under `references/blind-acceptance.md`: multiple tasks, cross-crate changes, or changed
   externally observable behavior. Before sharing any design context, prepare the original
   request and user amendments and dispatch a **fresh read-only `qa-lead`** using that
   document's input boundary and assignment. Do not reuse a spec-aware QA worker. If the
   host cannot isolate the context or the original request is missing, continue the ordinary
   checks but record required blind acceptance as **unverified**, never passed.
   A small-change skip needs its applicability reason in the report.
2. Read the spec's **acceptance criteria**. When its linked intent, normally
   `intent/<slug>.md`, exists, check that each criterion supports the **Proposed outcome** and
   respects its **Constraints**. Carry unresolved **Open questions** into the report instead of
   silently deciding them in implementation. Report a mismatch as a finding: a technically green
   implementation can still solve the wrong problem. No intent means skip this trace, not fail it.
3. **First among ordinary checks, run the spec-level outer acceptance test** — a green outer test is the primary
   executable proof the feature is met (`references/testing-model.md`). Where the spec has an
   acceptance ledger (`.rust-studio/specs/<slug>/acceptance.md`), re-verify it next through
   `/acceptance` (`--reverify`, never `--status` — old evidence is not re-execution) and carry its
   summary line into the report: each gate id is a criterion's evidence, `NOT MET` is NEEDS WORK
   with the unmet and stale ids as the list, `HANDOFF REQUIRED` is BLOCKED with the abandonment
   named (`references/acceptance-ledger.md`). The checker rewrites evidence lines itself; that
   is not a source write. Then, for each remaining criterion, find and run the evidence:
   - Use the language-server layer (serena `find_symbol` or the harness `LSP` tool when
     available) and the harness Grep (ripgrep) to locate test functions
     and impl sites relevant to each criterion — never Bash `grep` for symbols; Grep-only
     when no language server, and say so once.
   - the project's gate (`references/project-gate.md`), including `--doc` for doc-tests — map
     test names to criteria in the report. Only where the project has none: `cargo nextest run`
     (fall back to `cargo test`) and `cargo clippy --all-targets --all-features -- -D warnings`.
   - `cargo fmt --check`.
   - `cargo +nightly miri test` if `unsafe` was involved; criterion benches if perf was
     a criterion.
4. Spawn the relevant **gate owners** in parallel (QA-GATE always; add API/ASYNC/PERF/
   SAFETY/RELEASE as the spec touched them). Spawn `rust-reviewer` for a final diff
   audit. Gate owners report pass/fail — don't ask the user about tactical gate details.
5. Reconcile the independent result with the spec only after that worker returns. Apply
   `references/blind-acceptance.md`'s combined-verdict rules: a retained user requirement
   missing from the spec still blocks Done; an explicitly withdrawn requirement does not.
   Quote the worker's verdict verbatim, record context exposure and distinguish actual runs
   from supplied logs/static inspection. Required unverified acceptance blocks COMPLETE.
6. Delegate to `rust-builder`: write `.rust-studio/specs/<slug>/verify-report.md` from
   `references/templates/verify-report.md` — each criterion → pass/fail
   + evidence, independent requirement results and input provenance, commands run, gates
   cleared, disagreements and follow-ups. Only reporting and successful archival bookkeeping
   (status and durable memory) may write; do not repair sources
   or rewrite intent/spec criteria to make verification pass.
7. **On pass**: mark the spec `Status: Done` (delegate write). For each durable learning the
   work produced (a decision + rationale, a gotcha, a convention discovered), run `/remember`
   to persist it; suggest `/changelog` if user-facing; suggest `/commit` + `/pr`
   to ship — these are outward/irreversible, so confirm before running them.
   **On fail**: list each failing criterion with its gap; hand back to `/dev-task`.

## Output
A criterion-by-criterion verdict with evidence, then **COMPLETE / NEEDS WORK / BLOCKED**.
No green claim without the command output to back it. The **green outer acceptance test** is the
executable oracle where one exists; for the remaining criteria, prove each against the spec's
acceptance **text** — not merely "a test I added passes". Report pass-rate with the
**full denominator** — list skipped/ignored tests with a reason, never drop them from the count.
A vacuous test, a weakened assertion, or a skipped gate is `NEEDS WORK`, not a pass
(`references/integrity-and-evidence.md`).
