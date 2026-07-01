---
name: debug
description: "debug, root-cause, why is this failing, trace, panic, deadlock, hang, wrong output — find the ROOT cause of a Rust bug methodically: reproduce, isolate, hypothesize, instrument, fix the cause not the symptom, add a regression test. Use for runtime bugs, logic errors, panics, deadlocks, async hangs, or flaky behavior."
argument-hint: "[symptom, error text, or failing test]"
user-invocable: true
---

# /debug — root-cause a Rust bug

Find the *cause*, not a plausible patch. Discipline over guessing
(`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`). No symptom-masking, no
"probably" — every hypothesis is confirmed by evidence before you touch code.
Observability ships with the fix (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`,
observability-as-DoD).

## When NOT this skill
- Compile / borrow / trait / lifetime errors → `/fix-build` (drives `rust-build-resolver`).
- An intermittent *test* you already know is flaky → `/flaky-hunt`.
Use `/debug` for runtime bugs: wrong results, panics, deadlocks, async hangs, state corruption.

## Method (do not skip steps)
1. **Reproduce.** Turn `$ARGUMENTS` into a deterministic repro — the smallest command,
   input, or `#[test]` that fails every time. If you can't reproduce it, that is the bug to
   chase first (timing, env, ordering). State the exact repro.
2. **Locate.** Spawn **`rust-scout`** to map the involved types/functions/call-sites and
   what mutates the suspect state. Don't read the whole crate — get the blast radius.

   **Recall first:** `/recall <bug area>` (or reuse the session-start memory index if it already
   surfaced this area) — has this bug or area bitten us before? Carry prior gotchas and fixes into
   the hypotheses; say when a recalled note changes the approach. If nothing surfaces, proceed
   (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
3. **Hypothesize.** Write down 1–3 concrete, falsifiable hypotheses ("the lock is held
   across the `.await` so task B starves"). For a design-level cause, spawn **`harsh-critic`**
   to attack your assumptions.
4. **Instrument & bisect.** Confirm or kill each hypothesis with evidence — `tracing`
   spans/events, `dbg!`, `RUST_BACKTRACE=1`, `RUST_LOG`, `git bisect`, or a narrowing test.
   For concurrency, reach for **`concurrency-specialist`** (loom, lock-order, ordering) or
   **`async-runtime-specialist`** (cancellation, `select!`, spawn/`Send` bounds). Prefer a
   `tokio::time::pause` deterministic test over print-debugging a race.
5. **Fix the cause.** Change the root, not the symptom. If the type system can make the bug
   unrepresentable, prefer that (`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md` —
   structural fix over discipline). Hand the edit to **`rust-builder`** if non-trivial.
6. **Prove it.** Add a regression test that fails before and passes after. Land a typed error
   and/or a `tracing` span on the path so the next occurrence is observable, not silent.
   Run `cargo nextest run` (or `cargo test`) + `cargo clippy --all-targets -- -D warnings`.

## Output
```
ROOT CAUSE: <one sentence — the actual mechanism>.
EVIDENCE:   <the observation that proved it (trace line, bisect commit, failing assert)>.
FIX:        <what changed and why it kills the cause, file:line>.
GUARD:      <regression test added + observability landed>.
```
End with **COMPLETE** (cause fixed + regression green) or **STUCK** (state the disproven
hypotheses and the next experiment — never a guessed patch).

A root cause is a **durable gotcha**: on `COMPLETE`, run `/remember` to capture the cause and
the fix so the next occurrence is recognized fast — skip only if the bug was trivial/obvious
(`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
Then `/review` the change, or `/dev-task` any follow-up the root cause exposed.
