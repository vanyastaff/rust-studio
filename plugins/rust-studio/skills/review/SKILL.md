---
name: review
description: "review, audit, check — inspect a Rust diff or path for correctness bugs, soundness, scope creep, missing tests, and standards violations. Runs clippy and tests as evidence. Use before committing or merging."
argument-hint: "[optional path or git ref] [--full for parallel multi-lens]"
user-invocable: true
---

# /review — audit a Rust change

Review the change for real problems and produce a prioritized, severity-tagged findings
list with a merge verdict. Evidence over opinion (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`, §8 team execution).
Flag correctness, soundness, security, requirement gaps — AND maintainer-bar gaps. The default
lens is a strict crate maintainer who would reject mediocre code; compiles + clippy-clean +
tests-green + correct is the FLOOR (`${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`).
Non-idiomatic-but-working shape, wrong-crate placement, reinvented sibling primitives, and
clone-instead-of-borrow ARE in scope (they fail the maintainer bar). That is distinct from
speculative abstraction / future-proofing, which stays OUT of scope — don't push extra
abstraction or defensive code (`${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md` §"don't over-report").

## Orchestration
When agent teams are available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) and you run a
`--full` multi-lens pass, run it as a real team (the session already has one implicit shared
team — no `TeamCreate`): create one `TaskCreate` task per lens (these are independent and
read-only — no `addBlockedBy` between them) and spawn
each lens as a teammate so they run concurrently, reporting via `SendMessage`; the lead merges
and de-duplicates. The lighter alternative for these read-only lenses is to spawn each as a
**background subagent** (`background: true`) without forming a team. Otherwise (no teams, or a
single-reviewer pass) fall back to single-orchestrator delegation: spawn the lenses
sequentially and inline the diff + scope into each spawn prompt. Teammates don't inherit this
context (pass the diff/scope in the spawn prompt) and don't get bundled MCP (they rely on the
user's ambient serena/exa). Shut teammates down at the end with `SendMessage
{type:"shutdown_request"}` — there is no team to delete; idle teammates auto-hide.

## Scope
`$ARGUMENTS` may be a path or a git ref. Default to the working-tree diff
(`git diff` + staged + untracked `.rs`). State what you're reviewing.
If the intended story/acceptance criteria aren't in the diff, infer from context
and proceed — ask only if the diff is genuinely ambiguous about its goal. Where an **outer
acceptance test** exists for the change, a green outer test is the spec-compliance anchor — check
the diff satisfies the observable criteria (nothing missing, nothing extra), not just the lines
(`${CLAUDE_PLUGIN_ROOT}/docs/testing-model.md`).

## How to run
1. Get the diff. Determine scope from context; proceed without asking unless the
   change's goal is truly opaque.
2. Spawn **`rust-reviewer`** for the core correctness/scope/test audit — including the
   Maintainer-shape audit (Maintainer Rejection Test on the TOUCHED area:
   `${CLAUDE_PLUGIN_ROOT}/docs/maintainer-grade-development.md`). That audit also covers:
   drop order / guard naming (`_guard`, never `_`) / `Drop` treated as best-effort with an
   explicit `close()`; `dyn`-compatibility breaks (generic methods need `where Self: Sized`,
   `async fn`/RPITIT aren't dyn-dispatchable); custom-container variance / missing `PhantomData`
   on owned-`T`; `repr` / FFI layout (`#[repr(C)]`, `transparent`, packed via `&raw`); `Box<dyn
   Error>` in a library surface (return a typed error); and stale-idiom modernization
   (`LazyLock`/`OnceLock`, `cfg_select!`, `&raw const/mut`, atomic `update`/`try_update`).
3. **`harsh-critic` is a DEFAULT lens** — spawn it (not only under `--full`) whenever the
   change embeds a non-trivial design/approach decision, to attack the SHAPE (wrong crate,
   reinvented sibling primitive, stale idiom, clone-to-appease, stringly/`bool` API), not just
   the lines. Stale-idiom and shape coverage matches the rust-reviewer audit above (drop order /
   guard naming / best-effort `Drop`, `dyn`-compat breaks, custom-container variance/`PhantomData`,
   `repr`/FFI layout, `Box<dyn Error>` in a lib, and `LazyLock`/`cfg_select!`/`&raw`/atomic-`update`
   modernization). Skip it only for genuinely mechanical diffs with no design call.
4. **Full review** (`--full`, or for breaking / public-API / large diffs): fan out the
   remaining relevant lenses **in parallel** (one task per lens, or background subagents — see
   Orchestration), then merge and de-duplicate findings. This is the multi-lens pass — it
   replaces the former `/team-review`:
   - `unsafe-auditor` if the diff touches `unsafe` (SAFETY-GATE).
   - `security-auditor` if it touches input parsing, auth, deserialization, or FFI.
   - `perf-engineer` if it touches hot paths or benches (PERF-GATE).
   - `api-design-lead` if it changes the public surface (API-GATE / semver).
   - `async-systems-lead` if it touches async/handlers (ASYNC-GATE).
5. Run evidence commands and cite output:
   - `cargo clippy --all-targets --all-features -- -D warnings`
   - `cargo nextest run` (fall back to `cargo test`)
   - `cargo +nightly miri test` when `unsafe` is involved (if available)
   - `cargo semver-checks` when the public API surface changes
   - `cargo audit` / `cargo deny check` when dependencies change

## Output
Merge and de-duplicate findings, ordered by severity, one line each:

```
path:line  🔴 BUG: <problem>. <fix>.
path:line  🟠 SOUNDNESS / SAFETY: <problem>. <fix>.
path:line  🟣 REDO: <wrong-shape/wrong-crate/non-idiomatic>. <reshape direction>.
path:line  🟡 SCOPE / MAINTAINABILITY: <problem>. <fix>.
path:line  🔵 TEST-GAP: <uncovered behavior>. <add test>.
```

Skip empty categories — no padding, no praise. End with verdict **COMPLETE (merge) /
NEEDS WORK (numbered blockers) / REDO-TO-BAR / BLOCKED**, plus the clippy/test summary:

- **REDO-TO-BAR** — compiles + clippy-clean + tests-green + correct, but a strict maintainer
  would reject the SHAPE (any 🟣 REDO finding). Merge-blocking but blast-radius-bounded: the
  author reshapes ONLY the TOUCHED area to the bar; untouched code is never force-reshaped, and
  it is not a license for speculative abstraction.

Offer to hand blockers to `rust-builder` via `/dev-task`.
