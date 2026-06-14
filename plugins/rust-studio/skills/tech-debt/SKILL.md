---
name: tech-debt
description: "audit scan log technical debt — TODO/FIXME, #[allow], unwrap in lib paths, oversized units, missing tests — produce a prioritized debt list and optionally file stories."
argument-hint: "[optional area]"
user-invocable: true
---

# /tech-debt — audit and log technical debt

Scan the codebase (or a scoped area) for technical debt, produce a prioritized
debt list, and offer to file stories. Evidence over opinion
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You do not fix anything
here unless the user explicitly asks — that goes through `/dev-task`.

## Input

`$ARGUMENTS` is an optional path, crate name, or keyword (e.g. `src/api`,
`my-crate`, `async`). If empty, scan the whole workspace. State what you're
scanning.

## Phase 1 — Locate (read-only; no approval needed)

Spawn **`rust-scout`** to map the workspace layout. Then run the following passes
and collect every hit with `file:line`:

1. **Debt markers** — `rg` for `TODO`, `FIXME`, `HACK`, `XXX`, `TEMP`,
   `WORKAROUND` in any comment or string literal.
2. **Suppressed lints** — `rg` for `#[allow(...)]` attributes that have no
   inline comment explaining the justification (`// allow: <reason>`). Flag each
   one.
3. **Panic paths in library code** — `rg` for `unwrap()`, `expect(`, `panic!(`,
   and `unreachable!()` inside `src/lib.rs` or any path that is not a test
   module, binary, example, or benchmark. (Calls inside `#[cfg(test)]` blocks
   are exempt.) Use serena `find_referencing_symbols` to confirm whether a
   panicking call is reachable from a public entry point.
4. **Oversized units** — use `tokei` for file-level LOC; flag files over ~400
   lines. For functions, use serena `get_symbols_overview` on flagged files to
   surface functions longer than ~60 lines. Note actual counts.
5. **Missing tests** — coordinate with **`qa-lead`**: use serena
   `get_symbols_overview` to enumerate `pub` items, then cross-check against
   `cargo llvm-cov` output for untested public surface and modules with no
   `#[cfg(test)]` block.

Run non-mutating cargo commands for supporting evidence:

```
cargo clippy --all-targets --all-features -- -D warnings
```

Cite the exit code and any relevant warning lines.

## Phase 2 — Triage

Present findings grouped by category. For each item record:

| Field      | Value |
|------------|-------|
| Location   | `file:line` |
| Category   | Marker / Allow / Panic-path / Oversized / Test-gap |
| Severity   | High / Medium / Low |
| Est. effort| Small (< 1 hr) / Medium (half-day) / Large (multi-day) |
| Notes      | Brief context |

**Severity heuristic:**
- High — `unwrap`/`panic` on a live code path that can crash a library
  caller; `FIXME` that documents a known correctness bug; completely untested
  public surface.
- Medium — unjustified `#[allow(...)]`; `TODO` that blocks a planned feature;
  oversized module making future change risky.
- Low — stylistic `HACK` notes; mildly oversized functions; coverage gaps in
  non-critical paths.

Sort the final list by severity × effort (high-severity, low-effort items
first). Skip categories with zero findings.

## Phase 3 — Gate check (consult leads)

After triaging, consult the relevant leads for their domain:

- **`qa-lead`** — confirm test-gap findings and suggest coverage targets.
- **`systems-perf-lead`** — weigh in on `#[allow(clippy::...)]` suppressions
  and panic paths in hot or `unsafe` code.
- **`api-design-lead`** — flag any debt on the public API surface
  (missing `#[non_exhaustive]`, undocumented `pub` items, etc.).

Only spawn leads whose domain overlaps with the findings.

## Phase 4 — Approval gate

`AskUserQuestion`: show the prioritized debt table. Ask the user:

> "Here is the debt inventory. Would you like to (a) accept it as-is, (b) add or
> remove items, or (c) adjust priorities before we decide next steps?"

## Phase 5 — Story filing (optional)

Once the list is approved, offer to file stories:

> "I can ask **`product-steward`** to break the high- and medium-severity items
> into actionable stories. Shall I proceed, and should I group them by area or by
> priority?"

If the user agrees, spawn **`product-steward`** with the approved debt list and
the user's grouping preference. `product-steward` will turn the debt items into
stories/tasks (see `/spec-tasks` and `${CLAUDE_PLUGIN_ROOT}/docs/templates/tasks.md`).

Do **not** write story files directly — delegate to `product-steward`.

## Output

End with a brief summary:

```
Debt scan complete.
  Scanned: <area>
  Total items: N  (High / Medium / Low)
  Stories filed: yes / no
  Next step: /dev-task <item> to fix the top item, or /review for a diff audit.
```

Verdict: **COMPLETE** (list delivered) / **NEEDS WORK** (blockers listed) /
**BLOCKED** (name the missing dependency and suggest a next step, e.g.
`/architecture` if the debt is entangled with an unresolved design question).
