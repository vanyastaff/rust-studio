---
name: spec-verify
description: "Use when verifying Rust implementation against a spec with tests, clippy, fmt, and gates before archiving."
---

# /spec-verify — verify against the spec (verify → archive)

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Prove the work meets `.rust-studio/specs/<slug>/spec.md`. Evidence over assertion
(`references/verdicts.md`, §7). You are the orchestrator:
**delegate writes (the verify report) to `rust-builder`**; do not write files directly.

## When NOT this skill
- You're not checking against a written spec — you want to restructure existing code
  without changing behavior → `/refactor`. `/spec-verify` only checks already-finished
  work against `.rust-studio/specs/<slug>/spec.md`; it doesn't touch code.
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
1. Read the spec's **acceptance criteria** (`input` = slug or path).
2. **First, run the spec-level outer acceptance test** — a green outer test is the primary
   executable proof the feature is met (`references/testing-model.md`). Then, for
   each remaining criterion, find and run the evidence:
   - Use serena MCP (`find_symbol`) and the harness Grep (ripgrep) to locate test functions
     and impl sites relevant to each criterion — never Bash `grep` for symbols.
   - `cargo nextest run` (fall back to `cargo test`), including `--doc` for doc-tests —
     map test names to criteria in the report.
   - `cargo clippy --all-targets --all-features -- -D warnings` and `cargo fmt --check`.
   - `cargo +nightly miri test` if `unsafe` was involved; criterion benches if perf was
     a criterion.
3. Spawn the relevant **gate owners** in parallel (QA-GATE always; add API/ASYNC/PERF/
   SAFETY/RELEASE as the spec touched them). Spawn `rust-reviewer` for a final diff
   audit. Gate owners report pass/fail — don't ask the user about tactical gate details.
4. Delegate to `rust-builder`: write `.rust-studio/specs/<slug>/verify-report.md` from
   `references/templates/verify-report.md` — each criterion → pass/fail
   + evidence, commands run, gates cleared, follow-ups.
5. **On pass**: mark the spec `Status: Done` (delegate write). For each durable learning the
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
