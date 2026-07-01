---
name: adopt
description: "Adopt / onboard an existing Rust crate or workspace into studio governance — reverse-engineer structure, infer domains and standards, summarize the public API, catalog debt/gaps, then delegate the docs."
argument-hint: "[optional path]"
user-invocable: true
---

# /adopt — onboard an existing Rust codebase

Bring an unfamiliar Rust crate or workspace under studio governance: map what exists,
infer the domains and standards already in use, surface the public API, catalog tech debt
and tooling gaps, then propose and delegate the docs that capture it all. You are the
orchestrator: **you do not write files yourself — you delegate to specialists.**
See `${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md` for the collaboration protocol.

## Input

`$ARGUMENTS` is an optional path to the crate or workspace root. If empty, default to the
current working directory. If the path does not look like a Rust project (no `Cargo.toml`),
ask: "Where is the crate or workspace you want to adopt?" before proceeding.

---

## Phase 1 — Map the structure

**Recall first (light):** `/recall <project>` (or reuse the session-start memory index) — prior
adoption notes exist if this was run before; carry them in. If nothing surfaces, proceed
(`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).

1. Spawn **`rust-scout`** on the target root. Ask it to return:
   - workspace members (if a workspace), crate names, and `lib`/`bin`/`proc-macro` layout,
   - module tree (top-level `mod` declarations and `pub use` re-exports),
   - `Cargo.toml` features, dependencies (direct + dev), and any `[patch]` / `[replace]`,
   - presence or absence of: `deny.toml`, `.cargo/config.toml`, `rust-toolchain.toml`,
     `clippy.toml`, `rustfmt.toml`, CI config files, benchmark harness, test fixtures.
2. Do not guess or assume — `rust-scout` is the source of truth for layout. Read-only;
   no writes at this phase.

---

## Phase 2 — Classify domains and infer standards

3. Run `/detect-stack` to classify which studio domains are in play, feeding it the scout
   report. It owns the canonical dependency-signal table (async/web, CLI/TUI, systems/perf,
   API surface, data/storage, WASM) — don't re-derive the signals here.
4. Identify which leads own each domain (see
   `${CLAUDE_PLUGIN_ROOT}/docs/agent-roster.md`). List them — they will be consulted in
   Phase 4.
5. Infer the implicit standards already in use: error handling style (`thiserror`,
   `anyhow`, custom enums), logging/tracing setup, test patterns (unit vs. integration vs.
   property-based), edition and MSRV (from `Cargo.toml`).

---

## Phase 3 — Summarize the public API

6. Spawn **`api-design-lead`** to read the public surface of each crate (exported traits,
   types, functions, `impl` blocks, feature flags that gate public items) and produce:
   - a structured summary of the API surface (group by module),
   - semver maturity assessment (is this `0.x`? are items `#[doc(hidden)]` or unstable?),
   - any obvious API design concerns (missing `#[non_exhaustive]`, leaky internals,
     unclear error types).

---

## Phase 4 — Catalog tech debt and tooling gaps

7. Fan out to the relevant domain leads **in parallel** based on Phase 2 classification.
   Each lead reviews the scout map for gaps within their domain:
   - `tooling-lead` — missing `deny.toml`, no `rust-toolchain.toml`, no CI config or CI
     that lacks lint/test/publish stages, no `rustfmt.toml`/`clippy.toml`. **If the scout
     reported many workspace members**, also assess context-scoping per
     `${CLAUDE_PLUGIN_ROOT}/docs/large-workspace.md`: per-crate `CLAUDE.md`, `permissions.deny`
     on `target/`/generated, the bundled rust-analyzer LSP for symbol lookup, sparse worktrees.
   - `qa-lead` — test coverage posture: no tests, tests that only cover happy paths,
     missing integration or doc tests, no property-based testing for data-heavy code.
   - `systems-perf-lead` — `unsafe` without `// SAFETY:` comments, missing `no_std`
     feature-gate declarations, absence of a benchmark harness if performance is claimed.
   - `async-systems-lead` — blocking calls in async contexts, missing cancellation
     handling, unstructured concurrency (spawn without join/abort handle).
   - `release-lead` — no `CHANGELOG`, missing `[badges]` or `[package.metadata]`,
     incomplete `[package]` fields required for crates.io publish.
   - `api-design-lead` — already engaged in Phase 3; add semver / breakage risk items here.
8. Collect all findings. Group by: **MISSING TOOLING**, **MISSING TESTS**,
   **UNSAFE / SOUNDNESS**, **API HYGIENE**, **ASYNC / CONCURRENCY**, **RELEASE HYGIENE**.

---

## Phase 5 — Propose docs and get approval (gate)

9. Based on the scout map and debt catalog, propose which studio docs to create. Default
   set for a non-trivial codebase:
   - `architecture.md` — crate/module map, dependency graph narrative, key design decisions
     already baked in (use `${CLAUDE_PLUGIN_ROOT}/docs/templates/architecture.md`).
   - One or more ADRs for each significant design choice already present (e.g. choice of
     async runtime, error strategy, storage layer) — use
     `${CLAUDE_PLUGIN_ROOT}/docs/templates/adr.md`.
   - A tech-debt register — distilled from Phase 4 findings.
10. `AskUserQuestion`: present the proposed doc set with a short rationale for each item.
    Let the user trim, add, or defer. **This is the only write-gate for doc creation.**
    Once approved, proceed directly to Phase 6 without re-asking.

---

## Phase 6 — Delegate doc writing

11. For each approved doc, delegate writing to the appropriate specialist — **never write
    docs directly from this skill**:
    - `architecture.md` → spawn **`chief-architect`** with the scout map and domain
      classification as context; instruct it to follow
      `${CLAUDE_PLUGIN_ROOT}/docs/templates/architecture.md`.
    - Each ADR → spawn **`chief-architect`** (or the owning domain lead for narrow
      decisions) per ADR topic; instruct it to follow
      `${CLAUDE_PLUGIN_ROOT}/docs/templates/adr.md`.
    - Tech-debt register → spawn **`tooling-lead`** to assemble from the Phase 4 findings.
12. Specialists write their approved docs and report back with the file path and a summary.
    If a specialist hits a genuine design fork not covered by the approved plan, surface it
    and `AskUserQuestion` at that point — otherwise proceed.

---

## Phase 7 — Output the adoption profile

13. Produce the **adoption profile** — a single structured summary the user can save or
    reference:

    ```
    ## Crate / workspace
    <name>, edition, MSRV, crate type(s)

    ## Domains in use
    <bulleted list with owning lead for each>

    ## Public API surface
    <one-paragraph summary from api-design-lead>

    ## Tooling baseline
    <what's present / what's missing>

    ## Tech debt (prioritized)
    🔴 CRITICAL   — <items that block correctness or safety>
    🟠 HIGH        — <items that block production readiness>
    🟡 MEDIUM      — <items that block quality gates>
    🔵 LOW         — <nice-to-have improvements>

    ## Docs created
    <list of files written and their paths>
    ```

14. End with a **prioritized adoption todo** — the three to five actions with the highest
    leverage, ordered by risk/impact. For each, name the skill to run next:
    - Missing CI or `deny.toml` → `/ci-gate` or `/tech-debt`
    - No architecture doc → already handled above, or re-run `/architecture`
    - Unsafe without SAFETY docs → `/dev-task` scoped to the unsafe module
    - No tests → `/test-setup`
    - Large workspace not scoped for context → apply
      `${CLAUDE_PLUGIN_ROOT}/docs/large-workspace.md` (per-crate `CLAUDE.md`, deny `target/`,
      the bundled rust-analyzer LSP, sparse worktrees) using
      `${CLAUDE_PLUGIN_ROOT}/docs/templates/large-workspace-settings.json`
    - Public API hygiene issues → `/review` in **full** mode

15. **Seed the memory vault.** Adoption infers a project's durable facts in one pass — persist
    them so the vault starts populated: run `/remember` for the domain map decision, each
    inferred convention (error style, test patterns, MSRV posture), and the top gotchas from the
    debt catalog (it dedups). Report the note paths
    (`${CLAUDE_PLUGIN_ROOT}/docs/memory-protocol.md`).

---

## Handoff

At the end of the session, offer to hand off directly:

- `/architecture` — to go deeper on module/crate boundaries or generate a full ADR.
- `/tech-debt` — to triage and schedule the debt items from Phase 4.
- `/test-setup` — to scaffold a test harness if coverage is absent or sparse.
- `/review` — to run a full audit on a specific sub-crate or diff right now.

---

## Error recovery

If **`rust-scout`** cannot find a `Cargo.toml`, stop immediately and `AskUserQuestion`:
"I couldn't find a Cargo.toml at that path. Please provide the correct path, or confirm
this is the right directory."

If a domain lead returns **BLOCKED** (e.g. ambiguous design, no source to read), surface
the blocker, note it in the debt register as a gap, and continue with the remaining
phases. Never silently skip a finding — always report what could not be assessed and why.
