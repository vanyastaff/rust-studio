---
name: bloat
description: "bloat binary size cargo-bloat llvm-lines strip lto monomorphization — measure what makes the binary big, cut it with profile settings and code changes, and prove the delta in bytes. Use when a CLI/wasm/embedded binary is too large, before shipping a size-sensitive artifact, or when compile times explode from monomorphization."
argument-hint: "[optional binary/package, or a size budget like '5MB']"
user-invocable: true
---

# /bloat — measure binary size, cut it, prove the delta

Binary size work with the same discipline as `/perf`: **measure first, cut second, prove
with before/after bytes.** Runtime speed is `/perf`'s job; this skill owns the artifact —
CLI download size, wasm payload, embedded flash budget, and the monomorphization bloat
that also drives compile times. You are the orchestrator: **you delegate all code and
manifest writes to `rust-builder`.** Honor the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`); size standards live in
`${CLAUDE_PLUGIN_ROOT}/rules/perf.md` and `${CLAUDE_PLUGIN_ROOT}/rules/wasm.md`.

## Input

`$ARGUMENTS` may name a binary/package, state a budget ("under 5MB", "wasm < 300KB
gzipped"), or be empty. If empty, pick the primary `[[bin]]` target (or the wasm/cdylib
artifact for wasm projects) and say so. If a budget was given, every phase reports
distance to it.

## Phase 0 — Baseline (the number everything is judged against)

0. **Recall first:** `/recall binary size <target>` — a prior size budget, past cuts, and
   trade-offs already rejected bind this pass; say when a recalled note changes the plan
   (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).
1. Build the honest artifact: `cargo build --release` (for wasm: the project's real
   pipeline including `wasm-opt`/gzip, since that is what ships). Record the size with
   `ls -l` — and for wasm also the **gzipped** size; for embedded, `cargo size` /
   flash usage. This byte count is the baseline; paste it.
2. Check the release profile before touching code — profile wins are free and often
   dominate. Report which of these are already set vs. defaulted:
   - `strip = "symbols"` (debug symbols are routinely 50–80% of an unstripped binary)
   - `lto = "thin"` (or `true` for max-size-sensitive; wasm/embedded per their rules)
   - `codegen-units = 1`, `panic = "abort"` (state the unwinding trade-off explicitly),
   - `opt-level = "z"`/`"s"` **only** for size-dominated targets (wasm/embedded) — on a
     hot CLI it can cost real speed; flag the trade instead of applying it by reflex.

## Phase 1 — Attribute (where the bytes actually are)

3. Tooling (offer `cargo install` for whichever is missing):
   - `cargo bloat --release -n 20` — biggest functions.
   - `cargo bloat --release --crates -n 20` — size per dependency crate.
   - `cargo llvm-lines --release | head -30` — monomorphization hot spots (which
     generic instantiates most; this is also the compile-time villain).
   - wasm: `twiggy top` if available, plus the post-`wasm-opt` numbers.
4. Read the attribution like a profile — find the *category* of each big item:
   - **A dependency you barely use** — a full regex/serde/clap pulled in for one call.
   - **Feature bloat** — default features nobody turned off (`default-features = false`).
   - **Monomorphization** — one generic stamped out for N types (`cargo llvm-lines`
     names the offender); `#[inline]` sprayed on cold code.
   - **Macro output** — heavy derives/proc-macros expanding into code per call site
     (a separate villain from generics; visible as many similar symbols in `cargo bloat`).
   - **Format machinery** — `Debug`/`Display` derives and panic/format strings across
     hundreds of types (visible as `core::fmt` weight).
   - **Symbols/unwinding/std** — not yet stripped, unwind tables, or (embedded) std
     creeping into a no_std target.
5. Present a ranked cut list (top ~8), each with expected saving and cost:
   ```
   <item>  ~<KB estimate>  <fix> — <trade-off, if any>
   ```

## Phase 2 — Decide

6. Order by savings-per-risk: profile settings first (zero code risk), then feature
   flags and dependency swaps (semver/behavior risk: run `/deps-check` thinking),
   then code changes (e.g. `fn inner(&str)` behind a generic `AsRef<str>` shim to cut
   monomorphization — the classic `impl Trait`-to-inner-fn pattern), last API-visible
   changes (need `api-design-lead`).
7. State the plan and proceed. `AskUserQuestion` only for genuine forks: dropping a
   user-visible feature, `panic = "abort"` on a library-consumed binary, or replacing a
   dependency with different behavior.

## Phase 3 — Cut and measure each step

8. Delegate each change to **`rust-builder`**, one logical change at a time, and
   **re-measure after each**: rebuild, record the new byte count, keep a running table.
   A cut that saves nothing gets reverted, not kept as cargo-cult. Tests must stay
   green after every step (behavior-preserving bar, as in `/refactor`).
9. For dependency swaps/removals also cite `cargo tree -i <crate>` before/after so the
   change is visible in the graph, and re-run `cargo bloat --crates` to confirm the
   crate actually left the binary (features unify — removing your direct dep does not
   always remove the code).

## Phase 4 — Verdict

10. Report the table: baseline → per-step → final bytes (and gzipped for wasm), with %
    delta and distance to the budget if one was set. Paste the final `cargo bloat`
    top-10 as evidence.
11. Honesty bar (`${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`): sizes are
    from the same profile and target, stripped state stated; never compare a stripped
    "after" against an unstripped "before". If a saving came purely from `strip`, say
    that — it is real but it is one line, not an engineering campaign.
12. Offer to lock the win in: a CI size check (fail if the artifact grows > X%) — the
    gate is `tooling-lead`'s policy call (BUILD-GATE owner), `build-engineer` implements —
    and record the budget decision with `/remember`.
13. End with **COMPLETE / NEEDS WORK (numbered blockers) / BLOCKED**. Suggest `/perf`
    if a size cut risked runtime speed, `/deps-check` if the graph carries more
    removable weight, `/msrv-check` if profile options bumped the toolchain floor.

## Error recovery

If a size-motivated change breaks the build, hand it to **`rust-build-resolver`**; if
it changes behavior (a test fails), revert it — size is never worth silent behavior
change. If `cargo bloat`/`llvm-lines` can't parse the target (e.g. some wasm setups),
fall back to `twiggy`/`wasm-opt` reporting or plain symbol maps (`nm --size-sort`),
and label the coarser attribution as such.
