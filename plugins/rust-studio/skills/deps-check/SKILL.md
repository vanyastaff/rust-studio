---
name: deps-check
description: "dependency check, cargo-deny, outdated, duplicates, features, MSRV, licenses — dependency-hygiene pass: bans/licenses/sources (cargo-deny), duplicate/outdated versions, feature unification, MSRV. For code-level attacker-facing security review use /security-audit instead."
user-invocable: true
---

# /deps-check — audit workspace dependencies

Run a full dependency health audit through **dependency-manager**, honoring the
collaboration protocol (`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`). You are
the orchestrator: **you do not modify Cargo.toml or Cargo.lock yourself — delegate all
writes to `rust-builder`.** Decide tactical calls and proceed; escalate only at genuine
forks and before irreversible writes (per protocol §1).

## Phase 1 — Gather evidence (no approval needed)

All commands in this phase are read-only; run them without asking first.

1. Spawn **`dependency-manager`** to run the full suite in parallel and collect raw output:

   - **`cargo deny check`** — advisories, bans, licenses, and sources.
     Cite every finding with its ID (e.g. `RUSTSEC-2024-XXXX`), severity, and affected
     crate. Reference `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md` for workspace-level
     deny configuration expectations.
   - **`cargo audit`** — cross-check advisories against the RustSec database directly;
     use alongside `deny` to catch anything the deny config doesn't cover.
   - **`cargo outdated`** — list every crate with a newer compatible or semver-breaking
     version. Separate patch/minor from major bumps.
   - **`cargo tree -d`** — detect duplicate versions of the same crate. Flag any crate
     appearing at 2+ semver-incompatible versions; note which dependency paths pull each.
   - **`cargo shear`** — surface unused *and misplaced* (dev/build in the wrong section)
     direct dependencies; AST-based, so far fewer false hits than `cargo machete`. Add
     `--expand` (nightly) if the workspace is macro-heavy; suppress a true false positive
     via `[package.metadata.cargo-shear] ignored = [..]`, never by skipping the check.
     Fallbacks: `cargo machete` (regex, fast) or `cargo udeps` (nightly, compiler-based).
   - **Feature unification scan** — `cargo tree --edges features` on the workspace to
     surface unexpected feature unification: features enabled in one crate that activate
     unintended behaviour in a shared dependency.
   - **MSRV check** — compare `package.rust-version` in each crate's `Cargo.toml` against
     the CI toolchain pin. Use `cargo hack --rust-version` or `cargo msrv` if available.
     Flag any dependency whose documented MSRV requirement exceeds the workspace floor.

2. **`dependency-manager`** returns a structured findings list. Do not proceed to Phase 2
   until it completes.

## Phase 2 — Triage and present options (gate)

3. Merge and de-duplicate findings. Group by action category:

   ```
   [ADVISORY]   crate@ver  RUSTSEC-ID  severity  — description
   [BAN]        crate@ver  — reason from deny config
   [LICENSE]    crate@ver  — license conflict
   [OUTDATED]   crate@ver  → latest  (patch | minor | MAJOR)
   [DUPLICATE]  crate  ver-A  ver-B  — pulled by: <path>
   [UNUSED]     crate@ver  — no uses found
   [FEAT-UNIFY] feature  — unexpectedly enabled in: <crate>
   [MSRV]       crate@ver  requires rust X.Y > workspace floor Z.W
   ```

   Skip empty categories. Order by severity: ADVISORY/BAN > MAJOR-OUTDATED > DUPLICATE >
   MINOR/PATCH > UNUSED > FEAT-UNIFY > MSRV.

4. For any non-trivial resolution with more than one viable path (e.g. pin vs. bump vs.
   remove a crate with an advisory), present **2–4 options with trade-offs and a
   recommended default** before proceeding.

5. `AskUserQuestion`: show the full findings table and proposed action plan. Get explicit
   approval before drafting changes. If the user wants to adjust scope or defer items,
   revise the plan and ask again.

## Phase 3 — Draft changes (gate)

6. Once approved, spawn **`dependency-manager`** (and `tooling-lead` for workspace-config
   concerns) to produce a concrete diff:
   - **pin** — add a `=` version constraint or `[patch]` override to isolate a vulnerable
     transitive dep while a fix is unavailable upstream.
   - **bump** — update the version specifier in the relevant `Cargo.toml`(s) and run
     `cargo update -p <crate>` to narrow the lock.
   - **remove** — delete the dependency entry and fix any resulting compilation errors.
   - **dedupe** — add a `[patch]` entry or tighten the version range so the resolver
     collapses duplicates to a single version.
   - Reference `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md` for field ordering,
     workspace-inheritance patterns, and feature-gate conventions.

7. Show the proposed diff (Cargo.toml changes + lock-file summary). `AskUserQuestion` for
   sign-off before any file is written (irreversible action per protocol §1).

## Phase 4 — Apply and verify

8. Delegate all writes to **`rust-builder`** with the approved diff. Instruct it to:
   - Apply the `Cargo.toml` / `Cargo.lock` changes.
   - Run `cargo deny check` and `cargo audit` again — must be clean.
   - Run `cargo build --workspace --all-features` and `cargo nextest run --workspace` —
     must pass. Cite the output.
   - Run `cargo clippy --all-targets --all-features -- -D warnings` — must be clean.

9. If any build or test fails after the change, hand the failure back to **`rust-builder`**
   (loop Phase 4) until clean, or surface a **BLOCKED** verdict if a dep conflict cannot
   be resolved automatically.

## Phase 5 — Verdict

10. Summarize: findings addressed, findings intentionally deferred (with reason), evidence
    (cargo deny / audit / build / test output). End with **COMPLETE / NEEDS WORK / BLOCKED**.

11. Suggest follow-up actions as appropriate:
    - `/review` if dependency changes touched public API surface.
    - `/dev-task` if a bump introduced a breaking API change requiring code fixes.
    - `release-lead` consultation if MSRV was raised or a breaking transitive change
      affects the published crate surface.

## Error recovery

If **`dependency-manager`** returns **BLOCKED** (conflicting version requirements with no
satisfying resolution, or a license that cannot be waived):
- Surface the blocker immediately with the full conflict graph.
- `AskUserQuestion` with options — (a) pin at the last acceptable version and track the
  issue, (b) replace the dependency with an alternative, (c) stop and open a separate
  `/dev-task` to refactor the dependency boundary.
- Never discard completed findings — keep already-resolved items in the summary.
